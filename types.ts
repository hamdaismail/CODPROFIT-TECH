
export interface Product {
  id: string;
  name: string;
  price_production: number;
  price_shipping: number;
  countries: string[]; // Changed from single country string to array
  note?: string;
  image?: string; // Base64 string for mini image
}

export enum OrderStatus {
  PROCESSED = 'PROCESSED',
  DELIVERED = 'DELIVERED',
  PAID = 'PAID',
  RETURNED = 'RETURNED',
  CANCELED = 'CANCELED'
}

export interface Sale {
  id: string;
  date: string; // ISO date YYYY-MM-DD
  full_name: string;
  phone: string;
  product_id: string;
  quantity: number;
  total_price: number; // Selling price (Chiffre d'affaire)
  delivery_price: number; // Service Fees
  status: OrderStatus;
  country: string;
}

export interface Expense {
  id: string;
  date: string;
  amount: number;
  type: 'ADS' | 'FIXED' | 'TEST';
  platform?: string; // For Ads/Test
  name?: string; // For Fixed (Description)
  product_id?: string; // For Ads/Test/Fixed linking
  country: string;
  note?: string;
}

export interface CountrySettings {
  id: string;
  code: string;
  name: string;
  currency_code: string; // MAD, USD, CFA
  exchange_rate_to_usd: number;
  service_fee: number;
  service_fee_percentage?: number; // New field for % fee
  is_primary?: boolean;
}

export interface AppState {
  products: Product[];
  sales: Sale[];
  expenses: Expense[];
  settings: {
    countries: CountrySettings[];
    primaryCurrency: 'USD' | 'MAD';
  };
}
