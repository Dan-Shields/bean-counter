const CACHE_KEY = 'currency_rates';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

interface CachedRates {
  rates: Record<string, number>;
  timestamp: number;
}

/**
 * Get currency exchange rates from API or cache
 * Uses exchangerate-api.io free tier (1,500 requests/month)
 */
export async function getExchangeRates(baseCurrency: string): Promise<Record<string, number>> {
  // Check cache first
  const cached = localStorage.getItem(CACHE_KEY);
  if (cached) {
    const cachedData: CachedRates = JSON.parse(cached);
    const age = Date.now() - cachedData.timestamp;

    if (age < CACHE_DURATION && cachedData.rates[baseCurrency]) {
      return cachedData.rates;
    }
  }

  try {
    // Fetch fresh rates (using the free API endpoint)
    const response = await fetch(`https://api.exchangerate-api.com/v4/latest/${baseCurrency}`);

    if (!response.ok) {
      throw new Error('Failed to fetch exchange rates');
    }

    const data = await response.json();
    const rates = data.rates;

    // Cache the rates
    const cacheData: CachedRates = {
      rates,
      timestamp: Date.now(),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));

    return rates;
  } catch (error) {
    console.error('Error fetching exchange rates:', error);

    // Return cached rates if available, even if expired
    if (cached) {
      const cachedData: CachedRates = JSON.parse(cached);
      return cachedData.rates;
    }

    // Fallback: return 1:1 ratio
    return { [baseCurrency]: 1 };
  }
}

/**
 * Convert amount from one currency to another
 */
export async function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string
): Promise<number> {
  if (fromCurrency === toCurrency) {
    return amount;
  }

  const rates = await getExchangeRates(fromCurrency);
  const rate = rates[toCurrency];

  if (!rate) {
    console.warn(`No exchange rate found for ${fromCurrency} to ${toCurrency}`);
    return amount;
  }

  return amount * rate;
}

/**
 * Format currency amount with symbol
 */
export function formatCurrency(amount: number, currency: string): string {
  const symbols: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    DKK: 'kr',
  };

  const symbol = symbols[currency] || currency;
  const formatted = amount.toFixed(2);

  // For DKK and some currencies, put symbol after
  if (currency === 'DKK') {
    return `${formatted} ${symbol}`;
  }

  return `${symbol}${formatted}`;
}
