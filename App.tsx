import React, { useState, useEffect, useMemo, createContext, useContext, useRef } from 'react';
import { HashRouter as Router, Routes, Route, NavLink, useLocation, Navigate, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Package, ShoppingBag, Megaphone, 
  Wallet, Settings, BarChart3, Moon, Sun, Plus, 
  FileSpreadsheet, Upload, Trash2, ArrowRight, UserCircle, LogOut,
  Filter, Calendar, ChevronDown, X, Save, Edit3, Search, MoreHorizontal, CheckCircle, AlertCircle
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, 
  LineChart, Line, Legend, AreaChart, Area 
} from 'recharts';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import { Product, Sale, Expense, CountrySettings, OrderStatus } from './types';
import { supabase } from './supabaseService';
import { Card, Button, Input, Select, StatCard, Badge } from './components/Components';

// --- Utils ---
const generateId = () => Math.random().toString(36).substr(2, 9);
const formatDate = (date: Date) => date.toISOString().split('T')[0];

const getDateRange = (filter: string, customStart?: string, customEnd?: string) => {
  const now = new Date();
  const today = formatDate(now);
  const yesterday = formatDate(new Date(new Date().setDate(now.getDate() - 1)));
  
  const getStartOfWeek = (d: Date) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(date.setDate(diff));
  };

  if (filter === 'today') return { start: today, end: today };
  if (filter === 'yesterday') return { start: yesterday, end: yesterday };
  
  if (filter === 'this_week') {
    const start = formatDate(getStartOfWeek(new Date()));
    return { start, end: today };
  }
  
  if (filter === 'last_week') {
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    const start = formatDate(getStartOfWeek(lastWeek));
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return { start, end: formatDate(end) };
  }

  if (filter === 'this_month') {
    const start = formatDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    return { start, end: today };
  }

  if (filter === 'last_month') {
    const start = formatDate(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1));
    const end = formatDate(new Date(new Date().getFullYear(), new Date().getMonth(), 0));
    return { start, end };
  }

  return { start: '2020-01-01', end: '2030-12-31' }; // All time
};

// --- Global Context ---
interface GlobalContextType {
  darkMode: boolean;
  toggleDarkMode: () => void;
  currency: 'USD' | 'MAD';
  setCurrency: (c: 'USD' | 'MAD') => void;
  products: Product[];
  sales: Sale[];
  expenses: Expense[];
  countries: CountrySettings[];
  refreshData: () => void;
  
  addProduct: (p: Product) => void;
  updateProduct: (p: Product) => void;
  deleteProduct: (id: string) => void;
  
  addSale: (s: Sale) => void;
  updateSale: (s: Sale) => void;
  deleteSale: (id: string) => void;

  addExpense: (e: Expense) => void;
  updateExpense: (e: Expense) => void;
  deleteExpense: (id: string) => void;

  addCountry: (c: CountrySettings) => void;
  updateCountry: (c: CountrySettings) => void;
  deleteCountry: (id: string) => void;
  
  user: any;
  loading: boolean;
}

const GlobalContext = createContext<GlobalContextType | undefined>(undefined);

const useGlobal = () => {
  const context = useContext(GlobalContext);
  if (!context) throw new Error("useGlobal must be used within GlobalProvider");
  return context;
};

// --- Mock Data ---
const MOCK_COUNTRIES: CountrySettings[] = [
  { id: 'ma', code: 'MA', name: 'Morocco', currency_code: 'MAD', exchange_rate_to_usd: 0.1, service_fee: 30, service_fee_percentage: 0, is_primary: true },
  { id: 'ga', code: 'GA', name: 'Gabon', currency_code: 'XAF', exchange_rate_to_usd: 0.0016, service_fee: 2000, service_fee_percentage: 10, is_primary: false }
];

const MOCK_PRODUCTS: Product[] = [
  { id: '1', name: 'Smart Watch Ultra', price_production: 15, price_shipping: 5, country: 'MA', note: 'Best seller' },
  { id: '2', name: 'Beard Trimmer Pro', price_production: 8, price_shipping: 2, country: 'GA' },
];

const MOCK_SALES: Sale[] = [
  { id: '1', date: '2023-10-24', full_name: 'Ahmed Bennani', phone: '0600000000', product_id: '1', quantity: 1, total_price: 499, delivery_price: 30, status: OrderStatus.DELIVERED, country: 'MA' },
  { id: '2', date: '2023-10-25', full_name: 'Jean Pierre', phone: '0611111111', product_id: '2', quantity: 1, total_price: 19000, delivery_price: 3900, status: OrderStatus.PROCESSED, country: 'GA' },
];

// --- Main App ---
export default function App() {
  const [darkMode, setDarkMode] = useState(true);
  const [currency, setCurrency] = useState<'USD' | 'MAD'>('USD');
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Data State
  const [products, setProducts] = useState<Product[]>(MOCK_PRODUCTS);
  const [sales, setSales] = useState<Sale[]>(MOCK_SALES);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [countries, setCountries] = useState<CountrySettings[]>(MOCK_COUNTRIES);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    if (darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');

    return () => subscription.unsubscribe();
  }, [darkMode]);

  const toggleDarkMode = () => setDarkMode(!darkMode);

  // Actions
  const addProduct = (p: Product) => setProducts([...products, p]);
  const updateProduct = (p: Product) => setProducts(products.map(x => x.id === p.id ? p : x));
  const deleteProduct = (id: string) => setProducts(products.filter(x => x.id !== id));

  const addSale = (s: Sale) => setSales([...sales, s]);
  const updateSale = (s: Sale) => setSales(sales.map(x => x.id === s.id ? s : x));
  const deleteSale = (id: string) => setSales(sales.filter(x => x.id !== id));

  const addExpense = (e: Expense) => setExpenses([...expenses, e]);
  const updateExpense = (e: Expense) => setExpenses(expenses.map(x => x.id === e.id ? e : x));
  const deleteExpense = (id: string) => setExpenses(expenses.filter(x => x.id !== id));

  const addCountry = (c: CountrySettings) => setCountries([...countries, c]);
  const updateCountry = (c: CountrySettings) => {
    let updated = countries.map(country => country.id === c.id ? c : country);
    if (c.is_primary) {
        updated = updated.map(u => u.id === c.id ? u : { ...u, is_primary: false });
    }
    setCountries(updated);
  };
  const deleteCountry = (id: string) => setCountries(countries.filter(x => x.id !== id));
  
  const refreshData = () => { /* Fetch from Supabase */ };

  const value = {
    darkMode, toggleDarkMode, currency, setCurrency,
    products, sales, expenses, countries,
    refreshData, 
    addProduct, updateProduct, deleteProduct,
    addSale, updateSale, deleteSale,
    addExpense, updateExpense, deleteExpense,
    addCountry, updateCountry, deleteCountry,
    user, loading
  };

  if (loading) return <div className="min-h-screen bg-[#09090b] flex items-center justify-center text-accent">Loading...</div>;

  return (
    <GlobalContext.Provider value={value}>
      <Router>
        {!user ? <AuthPage /> : <Layout />}
      </Router>
    </GlobalContext.Provider>
  );
}

// --- Layout ---
function Layout() {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-[#09090b] text-slate-900 dark:text-slate-50 font-sans font-light">
      <Sidebar />
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        <Header />
        <main className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth pb-20">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/stock" element={<StockPage />} />
            <Route path="/sales" element={<SalesPage />} />
            <Route path="/ads" element={<AdsPage />} />
            <Route path="/charges" element={<ChargesPage />} />
            <Route path="/analyze" element={<AnalyzeProductsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function Sidebar() {
  const { pathname } = useLocation();
  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: Package, label: 'Stock', path: '/stock' },
    { icon: ShoppingBag, label: 'Sales', path: '/sales' },
    { icon: Megaphone, label: 'Ads Spend', path: '/ads' },
    { icon: Wallet, label: 'Charges', path: '/charges' },
    { icon: BarChart3, label: 'Analyze Products', path: '/analyze' },
    { icon: Settings, label: 'Settings', path: '/settings' },
  ];

  return (
    <aside className="hidden md:flex flex-col w-64 border-r border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-black/20 backdrop-blur-xl h-full">
      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-accent to-purple-400 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-accent/20">
          CP
        </div>
        <span className="font-semibold tracking-tight text-lg">COD Profit</span>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-all duration-200 group ${
                isActive 
                ? 'bg-accent/10 text-accent font-medium' 
                : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              <item.icon size={18} className={isActive ? 'text-accent' : 'text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300'} />
              {item.label}
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}

function Header() {
  const { darkMode, toggleDarkMode, user } = useGlobal();
  const navigate = useNavigate();

  return (
    <header className="h-16 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-8 bg-white/50 dark:bg-[#09090b]/50 backdrop-blur-md sticky top-0 z-20">
      <div className="flex items-center gap-4"></div>
      <div className="flex items-center gap-4">
        <button onClick={toggleDarkMode} className="p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <div className="h-8 w-[1px] bg-zinc-200 dark:bg-zinc-800 mx-1"></div>
        <div 
          className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity" 
          onClick={() => navigate('/profile')}
        >
          <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center">
            <UserCircle size={18} className="text-zinc-500" />
          </div>
          <span className="text-xs font-medium hidden md:block">{user?.email?.split('@')[0]}</span>
        </div>
      </div>
    </header>
  );
}

// --- Dashboard ---
function Dashboard() {
  const { sales, expenses, products, currency, setCurrency, countries } = useGlobal();
  
  // Filters
  const [dateFilter, setDateFilter] = useState('this_month');
  const [selectedCountry, setSelectedCountry] = useState('all');
  const [selectedProduct, setSelectedProduct] = useState('all');
  const { start, end } = getDateRange(dateFilter);

  // Helper: Convert Local Currency -> Display Currency (for Sales)
  const getLocalToDisplayRate = (countryCode: string) => {
    const country = countries.find(c => c.code === countryCode);
    if (!country) return 0;
    
    // Rate Local -> USD
    const rateLocalToUSD = country.exchange_rate_to_usd;
    
    if (currency === 'USD') return rateLocalToUSD;

    // Display is MAD. Convert USD -> MAD
    const madCountry = countries.find(c => c.code === 'MA');
    const madRateToUSD = madCountry?.exchange_rate_to_usd || 0.1;
    
    // Rate Local -> MAD = (Local -> USD) * (1 / (MAD -> USD))
    return rateLocalToUSD * (1 / madRateToUSD);
  };

  // Helper: Convert USD -> Display Currency (for Expenses/Stock)
  const getUsdToDisplayRate = () => {
    if (currency === 'USD') return 1;
    // Display is MAD
    const madCountry = countries.find(c => c.code === 'MA');
    const madRateToUSD = madCountry?.exchange_rate_to_usd || 0.1;
    return 1 / madRateToUSD;
  };

  // Filter Data
  const filteredSales = sales.filter(s => {
    if (selectedCountry !== 'all' && s.country !== selectedCountry) return false;
    if (selectedProduct !== 'all' && s.product_id !== selectedProduct) return false;
    return s.date >= start && s.date <= end;
  });

  const filteredExpenses = expenses.filter(e => {
    if (selectedCountry !== 'all' && e.country !== selectedCountry) return false;
    if (selectedProduct !== 'all' && e.product_id !== selectedProduct) return false;
    return e.date >= start && e.date <= end;
  });

  // Calculate Metrics
  let totalSales = 0;
  let totalServiceFees = 0;
  let totalStockCost = 0;

  filteredSales.forEach(s => {
    const localRate = getLocalToDisplayRate(s.country);
    // Sale total_price is in Local Currency
    totalSales += s.total_price * localRate;
    totalServiceFees += s.delivery_price * localRate;

    const product = products.find(p => p.id === s.product_id);
    if (product) {
       // COGS is now in USD (as per user request)
       const productCostUsd = (product.price_production + product.price_shipping);
       const usdRate = getUsdToDisplayRate();
       totalStockCost += (productCostUsd * s.quantity) * usdRate;
    }
  });

  let totalAds = 0;
  let totalFixed = 0;
  let totalTest = 0;
  const usdRate = getUsdToDisplayRate();

  filteredExpenses.forEach(e => {
    // Expense Amount is in USD (as per user request)
    const val = e.amount * usdRate;
    if (e.type === 'ADS') totalAds += val;
    if (e.type === 'FIXED') totalFixed += val;
    if (e.type === 'TEST') totalTest += val;
  });

  const profit = totalSales - totalStockCost - totalServiceFees - totalAds - totalFixed - totalTest;
  const currencySymbol = currency === 'USD' ? '$' : 'DH';

  // Chart Data Preparation
  const chartData = useMemo(() => {
    const dateMap = new Map<string, {name: string, sales: number, profit: number}>();
    
    const addData = (date: string, salesAdd: number, profitAdd: number) => {
        if (!dateMap.has(date)) dateMap.set(date, { name: date, sales: 0, profit: 0 });
        const entry = dateMap.get(date)!;
        entry.sales += salesAdd;
        entry.profit += profitAdd;
    };

    filteredSales.forEach(s => {
       const localRate = getLocalToDisplayRate(s.country);
       const sVal = s.total_price * localRate;
       
       const prod = products.find(p => p.id === s.product_id);
       // COGS (USD -> Display)
       const costUsd = prod ? (prod.price_production + prod.price_shipping) : 0;
       const costVal = costUsd * s.quantity * usdRate;

       const fees = s.delivery_price * localRate;
       const pVal = sVal - costVal - fees;
       addData(s.date, sVal, pVal);
    });

    filteredExpenses.forEach(e => {
       // Expense (USD -> Display)
       addData(e.date, 0, -(e.amount * usdRate));
    });

    return Array.from(dateMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredSales, filteredExpenses, currency, products, countries]);

  // Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xl">
          <p className="text-sm font-medium mb-2">{new Date(label).toDateString()}</p>
          <div className="space-y-1">
             <div className="flex items-center gap-2 text-xs">
                 <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                 <span className="text-zinc-500">Sales:</span>
                 <span className="font-mono">{currencySymbol}{payload[0].value.toFixed(0)}</span>
             </div>
             <div className="flex items-center gap-2 text-xs">
                 <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                 <span className="text-zinc-500">Profit:</span>
                 <span className="font-mono">{currencySymbol}{payload[1].value.toFixed(0)}</span>
             </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header & Filter Bar */}
      <div className="flex flex-col gap-6">
        <div className="flex justify-between items-end">
             <div>
                <h1 className="text-3xl font-light tracking-tight text-zinc-900 dark:text-white">Dashboard</h1>
                <p className="text-sm text-zinc-500 mt-1 font-light">Financial overview & performance metrics</p>
             </div>
             <div className="flex bg-zinc-100 dark:bg-zinc-900 p-1 rounded-lg">
                <button onClick={() => setCurrency('USD')} className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${currency === 'USD' ? 'bg-white dark:bg-zinc-800 shadow-sm text-zinc-900 dark:text-white' : 'text-zinc-400 hover:text-zinc-600'}`}>USD</button>
                <button onClick={() => setCurrency('MAD')} className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${currency === 'MAD' ? 'bg-white dark:bg-zinc-800 shadow-sm text-zinc-900 dark:text-white' : 'text-zinc-400 hover:text-zinc-600'}`}>MAD</button>
             </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 pb-4 border-b border-zinc-200 dark:border-zinc-800">
             <div className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md">
                 <Calendar size={14} className="text-zinc-400"/>
                 <select 
                    value={dateFilter} 
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="bg-transparent text-sm font-medium focus:outline-none text-zinc-700 dark:text-zinc-300"
                 >
                    <option value="today">Today</option>
                    <option value="yesterday">Yesterday</option>
                    <option value="this_week">This Week</option>
                    <option value="last_week">Last Week</option>
                    <option value="this_month">This Month</option>
                    <option value="last_month">Last Month</option>
                    <option value="all">All Time</option>
                 </select>
             </div>

             <div className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md">
                 <Filter size={14} className="text-zinc-400"/>
                 <select 
                    value={selectedCountry} 
                    onChange={(e) => setSelectedCountry(e.target.value)}
                    className="bg-transparent text-sm font-medium focus:outline-none text-zinc-700 dark:text-zinc-300"
                 >
                    <option value="all">All Countries</option>
                    {countries.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                 </select>
             </div>

             <div className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md">
                 <Package size={14} className="text-zinc-400"/>
                 <select 
                    value={selectedProduct} 
                    onChange={(e) => setSelectedProduct(e.target.value)}
                    className="bg-transparent text-sm font-medium focus:outline-none text-zinc-700 dark:text-zinc-300 max-w-[150px]"
                 >
                    <option value="all">All Products</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                 </select>
             </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Sales" value={`${currencySymbol} ${totalSales.toLocaleString(undefined, {maximumFractionDigits: 0})}`} subValue={`${filteredSales.length} Orders`} icon={ShoppingBag} color="text-indigo-500" />
        <StatCard title="Total Spend" value={`${currencySymbol} ${(totalStockCost + totalAds + totalServiceFees + totalFixed + totalTest).toLocaleString(undefined, {maximumFractionDigits: 0})}`} subValue="All Expenses" icon={Wallet} color="text-rose-500" />
        <StatCard title="Total Ads" value={`${currencySymbol} ${totalAds.toLocaleString(undefined, {maximumFractionDigits: 0})}`} subValue="Marketing" icon={Megaphone} color="text-blue-500" />
        <StatCard title="Net Profit" value={`${currencySymbol} ${profit.toLocaleString(undefined, {maximumFractionDigits: 0})}`} subValue={`${totalSales > 0 ? ((profit/totalSales)*100).toFixed(1) : 0}% Margin`} icon={BarChart3} color={profit >= 0 ? "text-emerald-500" : "text-red-500"} />
      </div>

      {/* Main Chart */}
      <Card className="h-[450px] p-0 overflow-hidden relative border-none ring-1 ring-zinc-200 dark:ring-zinc-800 shadow-lg">
          <div className="absolute top-6 left-6 z-10">
            <h3 className="font-medium text-lg">Profit & Sales Trend</h3>
            <p className="text-xs text-zinc-500">Daily performance breakdown</p>
          </div>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 80, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#333" opacity={0.05} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#a1a1aa', fontSize: 11}} dy={10} 
                     tickFormatter={(str) => {
                         const date = new Date(str);
                         return `${date.getDate()}/${date.getMonth()+1}`;
                     }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="sales" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorSales)" />
              <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorProfit)" />
            </AreaChart>
          </ResponsiveContainer>
      </Card>
    </div>
  );
}

// --- Sales Page ---
function SalesPage() {
  const { sales, addSale, updateSale, deleteSale, products, countries } = useGlobal();
  const [mode, setMode] = useState<'list' | 'import' | 'manual'>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const defaultCountry = countries.length > 0 ? countries[0].code : 'MA';
  const [form, setForm] = useState<Partial<Sale>>({
    date: formatDate(new Date()),
    status: OrderStatus.PROCESSED,
    quantity: 1,
    country: defaultCountry
  });

  // Import State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importData, setImportData] = useState<any[]>([]);
  const [selectedImportCountry, setSelectedImportCountry] = useState(defaultCountry);

  // Removed Country and Delivery Price from columns as requested
  const [columns] = useState(['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R']);
  const [mapping, setMapping] = useState<Record<string, string>>(() => {
    return JSON.parse(localStorage.getItem('sales_import_mapping') || '{}');
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws, { header: 'A' });
      setImportData(data);
    };
    reader.readAsBinaryString(file);
  };

  const calculateFees = (countryCode: string, total: number) => {
      const cSettings = countries.find(c => c.code === countryCode);
      const fixed = cSettings?.service_fee || 0;
      const pct = cSettings?.service_fee_percentage || 0;
      return fixed + (total * pct / 100);
  };

  const processImport = () => {
    if (importData.length === 0) return;
    
    let count = 0;
    importData.forEach((row: any) => {
       const sale: Partial<Sale> = {
          id: generateId(),
          date: formatDate(new Date()), // Default
          status: OrderStatus.PROCESSED,
          quantity: 1,
          country: selectedImportCountry // Use selected country
       };

       const getVal = (field: string) => {
          const col = mapping[field];
          return row[col];
       };

       const dateRaw = getVal('Date');
       if (dateRaw) sale.date = String(dateRaw).substring(0, 10); 
       
       sale.full_name = getVal('Full Name');
       sale.phone = getVal('Phone');
       sale.quantity = Number(getVal('Quantity')) || 1;
       sale.total_price = Number(getVal('Total Price')) || 0;
       
       const prodName = getVal('Product');
       const prod = products.find(p => p.name === prodName || p.id === prodName);
       sale.product_id = prod?.id || products[0]?.id; // Fallback
       
       const statusRaw = getVal('Status');
       sale.status = (statusRaw as OrderStatus) || OrderStatus.PROCESSED;
       
       // Calculate delivery price based on formula
       sale.delivery_price = calculateFees(sale.country!, sale.total_price!);

       addSale(sale as Sale);
       count++;
    });

    alert(`Successfully imported ${count} orders.`);
    setMode('list');
    setImportData([]);
  };

  const saveMapping = () => {
    localStorage.setItem('sales_import_mapping', JSON.stringify(mapping));
    alert('Settings saved!'); // Confirm mapping save
  };

  const handleSave = () => {
     // Auto calc fees on save
     const delivery_price = calculateFees(form.country!, Number(form.total_price));
     
     const payload = {
       ...form,
       delivery_price: delivery_price, 
       total_price: Number(form.total_price),
       quantity: Number(form.quantity),
     } as Sale;

     if (editingId) {
         updateSale({ ...payload, id: editingId });
     } else {
         addSale({ ...payload, id: generateId() });
     }
     setMode('list');
     setEditingId(null);
     setForm({ date: formatDate(new Date()), status: OrderStatus.PROCESSED, quantity: 1, country: defaultCountry });
  };

  const handleEdit = (s: Sale) => {
      setForm(s);
      setEditingId(s.id);
      setMode('manual');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-light">Sales Orders</h1>
        <div className="flex gap-2">
           <Button variant="secondary" onClick={() => setMode('import')}><FileSpreadsheet size={16} className="mr-2"/> Import Excel</Button>
           <Button variant="accent" onClick={() => { setEditingId(null); setMode('manual'); }}><Plus size={16} className="mr-2"/> Add Manual</Button>
        </div>
      </div>

      {mode === 'manual' && (
         <Card className="animate-in fade-in slide-in-from-top-4 max-w-2xl mx-auto">
            <h3 className="text-lg font-medium mb-4">{editingId ? 'Edit Order' : 'Add New Order'}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <Input label="Date" type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
               <Input label="Full Name" value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} />
               <Input label="Phone" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
               <Select label="Country" value={form.country} onChange={e => setForm({...form, country: e.target.value})} options={countries.map(c => ({value: c.code, label: c.name}))} />
               <Select label="Product" value={form.product_id} onChange={e => setForm({...form, product_id: e.target.value})} options={products.map(p => ({value: p.id, label: p.name}))} />
               <Input label="Quantity" type="number" value={form.quantity} onChange={e => setForm({...form, quantity: Number(e.target.value)})} />
               <Input label="Total Price (Local Currency)" type="number" value={form.total_price} onChange={e => setForm({...form, total_price: Number(e.target.value)})} />
               <Select label="Status" value={form.status} onChange={e => setForm({...form, status: e.target.value as OrderStatus})} options={Object.keys(OrderStatus).map(s => ({value: s, label: s}))} />
            </div>
            <div className="mt-6 flex justify-end gap-2">
               <Button variant="ghost" onClick={() => setMode('list')}>Cancel</Button>
               <Button variant="primary" onClick={handleSave}>Save Order</Button>
            </div>
         </Card>
      )}

      {mode === 'import' && (
        <Card className="animate-in fade-in zoom-in-95">
           <div className="mb-8 text-center">
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xlsx, .xls" className="hidden" />
              <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl p-12 hover:border-accent transition-colors cursor-pointer bg-zinc-50/50 dark:bg-zinc-900/50">
                  <Upload className="mx-auto h-12 w-12 text-zinc-400 mb-4" />
                  <h3 className="text-lg font-medium">{importData.length > 0 ? `${importData.length} Rows Loaded` : 'Click to Upload Excel'}</h3>
              </div>
           </div>

           {importData.length > 0 && (
             <div className="space-y-4">
                <div className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
                    <Select 
                        label="Select Country for Import" 
                        value={selectedImportCountry} 
                        onChange={e => setSelectedImportCountry(e.target.value)} 
                        options={countries.map(c => ({value: c.code, label: c.name}))}
                    />
                </div>
                <div className="flex justify-between items-center">
                    <h4 className="text-sm font-medium uppercase tracking-wider text-zinc-500">Map Columns</h4>
                    <Button variant="secondary" size="sm" onClick={saveMapping}><Save size={14} className="mr-2"/> Save Mapping</Button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                   {['Date', 'Full Name', 'Phone', 'Product', 'Quantity', 'Total Price', 'Status'].map(field => (
                     <div key={field} className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
                        <label className="text-xs font-bold text-accent mb-1 block">{field}</label>
                        <Select 
                          value={mapping[field] || ''} 
                          onChange={e => setMapping({...mapping, [field]: e.target.value})}
                          options={[{value: '', label: 'Select Column'}, ...columns.map(c => ({value: c, label: `Column ${c}`}))]} 
                        />
                     </div>
                   ))}
                </div>
                <div className="flex justify-end mt-6 gap-3">
                  <Button variant="ghost" onClick={() => { setImportData([]); setMode('list'); }}>Cancel</Button>
                  <Button variant="primary" onClick={processImport}>Import {importData.length} Rows</Button>
                </div>
             </div>
           )}
           {importData.length === 0 && <Button variant="ghost" onClick={() => setMode('list')}>Back</Button>}
        </Card>
      )}

      {mode === 'list' && (
        <Card className="p-0 overflow-hidden overflow-x-auto border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-xs md:text-sm whitespace-nowrap">
            <thead className="bg-zinc-50 dark:bg-zinc-900/50 text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className="px-6 py-4 font-semibold">Date</th>
                <th className="px-6 py-4 font-semibold">Customer</th>
                <th className="px-6 py-4 font-semibold">Product</th>
                <th className="px-6 py-4 font-semibold text-right">Total Pay</th>
                <th className="px-6 py-4 font-semibold text-center">Status</th>
                <th className="px-6 py-4 font-semibold text-center">Country</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/50">
              {sales.map(s => {
                const prod = products.find(p => p.id === s.product_id);
                const net = s.total_price - s.delivery_price;
                return (
                <tr key={s.id} className="group hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                  <td className="px-6 py-4 text-zinc-500">{s.date}</td>
                  <td className="px-6 py-4 font-medium">
                      <div className="text-zinc-900 dark:text-zinc-200">{s.full_name}</div>
                      <div className="text-xs text-zinc-400 font-light">{s.phone}</div>
                  </td>
                  <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400">{prod?.name || 'Unknown'}</td>
                  <td className="px-6 py-4 font-mono font-bold text-emerald-600 dark:text-emerald-400 text-right">{net.toLocaleString()}</td>
                  <td className="px-6 py-4 text-center">
                    <Badge variant={s.status === OrderStatus.DELIVERED ? 'success' : s.status === OrderStatus.PAID ? 'info' : 'warning'}>
                      {s.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-center"><Badge>{s.country}</Badge></td>
                  <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleEdit(s)} className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded text-zinc-400 hover:text-accent"><Edit3 size={14}/></button>
                        <button onClick={() => deleteSale(s.id)} className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-zinc-400 hover:text-red-500"><Trash2 size={14}/></button>
                      </div>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

// --- Stock Page ---
function StockPage() {
  const { products, addProduct, updateProduct, deleteProduct, countries } = useGlobal();
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const defaultCountry = countries.length > 0 ? countries[0].code : 'MA';
  const [form, setForm] = useState<Partial<Product>>({ country: defaultCountry, price_production: 0, price_shipping: 0 });

  const handleSave = () => {
      const payload = { ...form, id: editingId || generateId() } as Product;
      if (editingId) updateProduct(payload);
      else addProduct(payload);
      setShowModal(false);
      setEditingId(null);
      setForm({ country: defaultCountry, price_production: 0, price_shipping: 0 });
  };

  const handleEdit = (p: Product) => {
      setForm(p);
      setEditingId(p.id);
      setShowModal(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-light">Inventory</h1>
        <Button variant="accent" onClick={() => { setEditingId(null); setShowModal(true); }}><Plus size={16} className="mr-2"/> Add Product</Button>
      </div>

      {showModal && (
        <Card className="mb-6 animate-in fade-in slide-in-from-top-4">
           <h3 className="font-medium mb-4">{editingId ? 'Edit Product' : 'Add Product'}</h3>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
             <Input label="Product Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
             <Select label="Country" value={form.country} options={countries.map(c => ({value: c.code, label: c.name}))} onChange={e => setForm({...form, country: e.target.value})} />
             <Input label="Production Cost ($)" type="number" value={form.price_production} onChange={e => setForm({...form, price_production: parseFloat(e.target.value || '0')})} />
             <Input label="Shipping Cost ($)" type="number" value={form.price_shipping} onChange={e => setForm({...form, price_shipping: parseFloat(e.target.value || '0')})} />
             <Input label="Note" value={form.note} onChange={e => setForm({...form, note: e.target.value})} className="md:col-span-2" />
           </div>
           
           <div className="bg-zinc-50 dark:bg-zinc-800 p-4 rounded-lg mb-4 flex justify-between items-center">
              <span className="text-sm font-medium text-zinc-500">Total Cost per Unit (USD)</span>
              <span className="text-xl font-bold text-accent">
                 ${((form.price_production || 0) + (form.price_shipping || 0)).toFixed(2)}
              </span>
           </div>

           <div className="flex justify-end gap-2">
             <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
             <Button variant="primary" onClick={handleSave}>Save Product</Button>
           </div>
        </Card>
      )}

      <Card className="p-0 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
            <tr>
              <th className="px-6 py-4">Product Name</th>
              <th className="px-6 py-4">Total Cost (USD)</th>
              <th className="px-6 py-4">Country</th>
              <th className="px-6 py-4">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {products.map(p => (
              <tr key={p.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                <td className="px-6 py-4 font-medium text-zinc-900 dark:text-zinc-100">{p.name}</td>
                <td className="px-6 py-4 font-bold text-accent">${p.price_production + p.price_shipping}</td>
                <td className="px-6 py-4"><Badge>{p.country}</Badge></td>
                <td className="px-6 py-4 flex gap-2">
                   <button onClick={() => handleEdit(p)} className="text-zinc-400 hover:text-accent"><Edit3 size={16}/></button>
                   <button onClick={() => deleteProduct(p.id)} className="text-zinc-400 hover:text-red-500"><Trash2 size={16}/></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// --- Ads Page ---
function AdsPage() {
    const { expenses, addExpense, updateExpense, deleteExpense, countries, products } = useGlobal();
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const defaultCountry = countries.length > 0 ? countries[0].code : 'MA';
    const [form, setForm] = useState<Partial<Expense>>({ type: 'ADS', date: formatDate(new Date()), country: defaultCountry });

    const handleSave = () => {
        const payload = { ...form, id: editingId || generateId(), type: 'ADS' } as Expense;
        if (editingId) updateExpense(payload);
        else addExpense(payload);
        setShowModal(false);
        setEditingId(null);
        setForm({ type: 'ADS', date: formatDate(new Date()), country: defaultCountry });
    };

    const handleEdit = (e: Expense) => {
        setForm(e);
        setEditingId(e.id);
        setShowModal(true);
    };

    return (
        <div className="space-y-6">
             <div className="flex justify-between items-center">
                <h1 className="text-2xl font-light">Ad Spend</h1>
                <Button variant="accent" onClick={() => { setEditingId(null); setShowModal(true); }}>Add Spend</Button>
            </div>

            {showModal && (
                <Card className="animate-in fade-in slide-in-from-top-4">
                    <h3 className="font-medium mb-4">{editingId ? 'Edit Ad Spend' : 'Record Ad Spend'}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="Date" type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
                        <Input label="Amount ($)" type="number" value={form.amount} onChange={e => setForm({...form, amount: Number(e.target.value)})} />
                        <div>
                            <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider ml-1">Platform</label>
                            <input 
                                list="platforms" 
                                className="flex h-10 w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 mt-1.5"
                                value={form.platform} 
                                onChange={e => setForm({...form, platform: e.target.value})} 
                                placeholder="Select or type..."
                            />
                            <datalist id="platforms">
                                <option value="Facebook" />
                                <option value="TikTok" />
                                <option value="Google" />
                                <option value="Snapchat" />
                            </datalist>
                        </div>
                        <Select label="Country" value={form.country} onChange={e => setForm({...form, country: e.target.value})} options={countries.map(c => ({value: c.code, label: c.name}))} />
                        <Select label="Linked Product (Optional)" value={form.product_id} onChange={e => setForm({...form, product_id: e.target.value})} options={[{value: '', label: 'None'}, ...products.map(p => ({value: p.id, label: p.name}))]} />
                    </div>
                    <div className="flex justify-end gap-2 mt-4">
                        <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
                        <Button variant="primary" onClick={handleSave}>Save Spend</Button>
                    </div>
                </Card>
            )}

            <Card className="p-0 overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
                        <tr>
                            <th className="px-6 py-4">Date</th>
                            <th className="px-6 py-4">Platform</th>
                            <th className="px-6 py-4">Product</th>
                            <th className="px-6 py-4">Amount ($)</th>
                            <th className="px-6 py-4">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                        {expenses.filter(e => e.type === 'ADS').map(e => (
                            <tr key={e.id}>
                                <td className="px-6 py-4">{e.date}</td>
                                <td className="px-6 py-4">{e.platform}</td>
                                <td className="px-6 py-4">{products.find(p => p.id === e.product_id)?.name || '-'}</td>
                                <td className="px-6 py-4 font-mono">${e.amount}</td>
                                <td className="px-6 py-4 flex gap-2">
                                    <button onClick={() => handleEdit(e)} className="text-zinc-400 hover:text-accent"><Edit3 size={16}/></button>
                                    <button onClick={() => deleteExpense(e.id)} className="text-zinc-400 hover:text-red-500"><Trash2 size={16}/></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Card>
        </div>
    )
}

// --- Charges Page ---
function ChargesPage() {
    const { expenses, addExpense, updateExpense, deleteExpense, countries, products } = useGlobal();
    const [tab, setTab] = useState<'FIXED' | 'TEST'>('FIXED');
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const defaultCountry = countries.length > 0 ? countries[0].code : 'MA';
    const [form, setForm] = useState<Partial<Expense>>({ date: formatDate(new Date()), country: defaultCountry });

    const handleSave = () => {
        const payload = { ...form, type: tab, id: editingId || generateId() } as Expense;
        if (editingId) updateExpense(payload);
        else addExpense(payload);
        setShowModal(false);
        setEditingId(null);
        setForm({ date: formatDate(new Date()), country: defaultCountry });
    };

    const handleEdit = (e: Expense) => {
        setForm(e);
        setEditingId(e.id);
        setShowModal(true);
    };

    return (
        <div className="space-y-6">
             <div className="flex justify-between items-center">
                <h1 className="text-2xl font-light">Charges</h1>
                <Button variant="accent" onClick={() => { setEditingId(null); setShowModal(true); }}>Add {tab === 'FIXED' ? 'Fixed' : 'Test'} Charge</Button>
            </div>

            <div className="flex gap-4 border-b border-zinc-200 dark:border-zinc-800">
                <button onClick={() => setTab('FIXED')} className={`pb-2 px-1 text-sm font-medium transition-all ${tab === 'FIXED' ? 'border-b-2 border-accent text-accent' : 'text-zinc-500'}`}>Fixed Charges</button>
                <button onClick={() => setTab('TEST')} className={`pb-2 px-1 text-sm font-medium transition-all ${tab === 'TEST' ? 'border-b-2 border-accent text-accent' : 'text-zinc-500'}`}>Test Charges</button>
            </div>

            {showModal && (
                <Card className="animate-in fade-in slide-in-from-top-4">
                     <h3 className="font-medium mb-4">{editingId ? 'Edit Charge' : `Add ${tab === 'FIXED' ? 'Fixed' : 'Test'} Charge`}</h3>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="Date" type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
                        
                        {tab === 'FIXED' && (
                            <div>
                                <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider ml-1">Charge Name</label>
                                <input 
                                    list="charge-types" 
                                    className="flex h-10 w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 mt-1.5"
                                    value={form.name} 
                                    onChange={e => setForm({...form, name: e.target.value})} 
                                    placeholder="Select or type..."
                                />
                                <datalist id="charge-types">
                                    <option value="Product Charge" />
                                    <option value="Store Fees" />
                                    <option value="Office Rent" />
                                </datalist>
                            </div>
                        )}

                        {tab === 'TEST' && (
                             <Input label="Platform" value={form.platform} onChange={e => setForm({...form, platform: e.target.value})} placeholder="e.g. Facebook" />
                        )}

                        <Input label="Amount ($)" type="number" value={form.amount} onChange={e => setForm({...form, amount: Number(e.target.value)})} />
                        <Select label="Country" value={form.country} onChange={e => setForm({...form, country: e.target.value})} options={countries.map(c => ({value: c.code, label: c.name}))} />
                        
                        <Select label="Linked Product (Optional)" value={form.product_id} onChange={e => setForm({...form, product_id: e.target.value})} options={[{value: '', label: 'None'}, ...products.map(p => ({value: p.id, label: p.name}))]} />
                        
                        <Input label="Note" value={form.note} onChange={e => setForm({...form, note: e.target.value})} className="md:col-span-2" />
                     </div>
                     <div className="flex justify-end gap-2 mt-4">
                         <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
                         <Button variant="primary" onClick={handleSave}>Save Charge</Button>
                     </div>
                </Card>
            )}

            <Card className="p-0 overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
                        <tr>
                            <th className="px-6 py-4">Date</th>
                            <th className="px-6 py-4">{tab === 'FIXED' ? 'Description' : 'Platform'}</th>
                            <th className="px-6 py-4">Amount ($)</th>
                            <th className="px-6 py-4">Country</th>
                            <th className="px-6 py-4">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                         {expenses.filter(e => e.type === tab).map(e => (
                             <tr key={e.id}>
                                 <td className="px-6 py-4">{e.date}</td>
                                 <td className="px-6 py-4">{tab === 'FIXED' ? e.name : e.platform}</td>
                                 <td className="px-6 py-4 font-mono">${e.amount}</td>
                                 <td className="px-6 py-4"><Badge>{e.country}</Badge></td>
                                 <td className="px-6 py-4 flex gap-2">
                                    <button onClick={() => handleEdit(e)} className="text-zinc-400 hover:text-accent"><Edit3 size={16}/></button>
                                    <button onClick={() => deleteExpense(e.id)} className="text-zinc-400 hover:text-red-500"><Trash2 size={16}/></button>
                                 </td>
                             </tr>
                         ))}
                    </tbody>
                </table>
            </Card>
        </div>
    )
}

// --- Analyze Products Page ---
function AnalyzeProductsPage() {
    const { products, sales, expenses, countries } = useGlobal();

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-light">Product Analysis</h1>
            
            <div className="grid grid-cols-1 gap-6">
                {products.map(product => {
                    const prodSales = sales.filter(s => s.product_id === product.id);
                    const prodExpenses = expenses.filter(e => e.product_id === product.id); 
                    
                    // Sales Revenue in Local Currency -> Need to normalize to a common one for display (e.g. USD)
                    // Let's assume this page displays in USD for consistency with costs
                    let totalRevenueUSD = 0;
                    let deliveryFeesUSD = 0;
                    
                    prodSales.forEach(s => {
                        const country = countries.find(c => c.code === s.country);
                        const rate = country?.exchange_rate_to_usd || 0;
                        totalRevenueUSD += s.total_price * rate;
                        deliveryFeesUSD += s.delivery_price * rate;
                    });

                    const totalUnits = prodSales.reduce((acc, s) => acc + s.quantity, 0);
                    // Costs are USD
                    const costOfGoodsUSD = totalUnits * (product.price_production + product.price_shipping);
                    const specificExpensesUSD = prodExpenses.reduce((acc, e) => acc + e.amount, 0);

                    const grossProfitUSD = totalRevenueUSD - costOfGoodsUSD - deliveryFeesUSD - specificExpensesUSD;

                    return (
                        <Card key={product.id}>
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-xl font-medium">{product.name}</h3>
                                    <div className="flex gap-2 mt-1">
                                        <Badge>{product.country}</Badge>
                                        <span className="text-xs text-zinc-500 flex items-center">{totalUnits} orders</span>
                                    </div>
                                </div>
                                <div className={`text-2xl font-light ${grossProfitUSD >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                    ${grossProfitUSD.toFixed(2)}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded">
                                    <div className="text-zinc-500">Revenue (Est. USD)</div>
                                    <div className="font-medium text-lg">${totalRevenueUSD.toFixed(0)}</div>
                                </div>
                                <div className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded">
                                    <div className="text-zinc-500">COGS</div>
                                    <div className="font-medium text-lg text-red-400">-${costOfGoodsUSD.toFixed(0)}</div>
                                </div>
                                <div className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded">
                                    <div className="text-zinc-500">Service Fees</div>
                                    <div className="font-medium text-lg text-red-400">-${deliveryFeesUSD.toFixed(0)}</div>
                                </div>
                                <div className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded">
                                    <div className="text-zinc-500">Ad/Test Spend</div>
                                    <div className="font-medium text-lg text-red-400">-${specificExpensesUSD.toFixed(0)}</div>
                                </div>
                            </div>
                        </Card>
                    )
                })}
            </div>
        </div>
    )
}

// --- Settings Page ---
function SettingsPage() {
    const { countries, addCountry, updateCountry, deleteCountry } = useGlobal();
    const [showAdd, setShowAdd] = useState(false);
    const [editingCountry, setEditingCountry] = useState<CountrySettings | null>(null);
    const [form, setForm] = useState<Partial<CountrySettings>>({});

    // Conversion helper state for UI
    const [usdEquivalent, setUsdEquivalent] = useState<string>(''); 
    const [madEquivalent, setMadEquivalent] = useState<string>(''); 

    const handleSave = () => {
        const payload = { ...form, id: editingCountry?.id || generateId() } as CountrySettings;
        if (editingCountry) updateCountry(payload);
        else addCountry(payload);
        
        setShowAdd(false);
        setEditingCountry(null);
        setForm({});
        setUsdEquivalent('');
        setMadEquivalent('');
    };

    const startEdit = (c: CountrySettings) => {
        setEditingCountry(c);
        setForm(c);
        
        // Internal: 1 Local = X USD.
        // UI USD: 1 USD = (1/X) Local.
        if (c.exchange_rate_to_usd > 0) {
            setUsdEquivalent((1 / c.exchange_rate_to_usd).toFixed(2));
            
            // UI MAD: 1 MAD = ? Local
            // 1 MAD approx 0.1 USD (from MA settings if exists, else hardcode approx)
            const ma = countries.find(x => x.code === 'MA');
            const maRate = ma?.exchange_rate_to_usd || 0.1; 
            // 1 Local = X USD. 1 MAD = maRate USD.
            // 1 MAD = (maRate / X) Local.
            setMadEquivalent((maRate / c.exchange_rate_to_usd).toFixed(2));
        } else {
            setUsdEquivalent('');
            setMadEquivalent('');
        }
        setShowAdd(true);
    };

    const handleUsdEquivChange = (val: string) => {
        setUsdEquivalent(val);
        const num = parseFloat(val);
        if (num > 0) {
            setForm(prev => ({ ...prev, exchange_rate_to_usd: 1 / num }));
            
            // Update MAD equiv visual
            const ma = countries.find(x => x.code === 'MA');
            const maRate = ma?.exchange_rate_to_usd || 0.1;
            // 1 USD = num Local.
            // 1 MAD = maRate USD = maRate * num Local.
            setMadEquivalent((maRate * num).toFixed(2));
        }
    };

    const handleMadEquivChange = (val: string) => {
        setMadEquivalent(val);
        const num = parseFloat(val);
        if (num > 0) {
            // 1 MAD = num Local.
            // 1 MAD = maRate USD.
            // maRate USD = num Local => 1 USD = (num / maRate) Local.
            // We store 1 Local = (maRate / num) USD.
            const ma = countries.find(x => x.code === 'MA');
            const maRate = ma?.exchange_rate_to_usd || 0.1;
            const rateLocalToUsd = maRate / num;
            setForm(prev => ({ ...prev, exchange_rate_to_usd: rateLocalToUsd }));
            
            // Update USD equiv visual: 1 USD = 1/rate
            setUsdEquivalent((1/rateLocalToUsd).toFixed(2));
        }
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <h1 className="text-2xl font-light">Settings</h1>
            
            <section>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium">Country Configurations</h3>
                    <Button variant="secondary" onClick={() => { setEditingCountry(null); setForm({}); setShowAdd(true); }}>Add New Country</Button>
                </div>

                {showAdd && (
                    <Card className="mb-6 border-accent/20">
                        <h4 className="font-medium mb-4">{editingCountry ? 'Edit Country' : 'New Country'}</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <Input label="Country Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                             <Input label="Code (e.g. MA)" value={form.code} onChange={e => setForm({...form, code: e.target.value})} />
                             <Input label="Currency Code" value={form.currency_code} onChange={e => setForm({...form, currency_code: e.target.value})} />
                             
                             {/* Exchange Rate Inputs */}
                             <div className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input 
                                    label={`1 USD = ? ${form.currency_code || 'Local'}`} 
                                    type="number" 
                                    value={usdEquivalent} 
                                    onChange={e => handleUsdEquivChange(e.target.value)} 
                                    placeholder="e.g. 680"
                                />
                                <Input 
                                    label={`1 MAD = ? ${form.currency_code || 'Local'}`} 
                                    type="number" 
                                    value={madEquivalent} 
                                    onChange={e => handleMadEquivChange(e.target.value)} 
                                    placeholder="e.g. 68"
                                />
                                <p className="text-xs text-zinc-500 md:col-span-2">
                                    Enter either rate. The system auto-calculates the other based on MA settings.
                                </p>
                             </div>

                             <Input label="Fixed Service Fee (Local Currency)" type="number" value={form.service_fee} onChange={e => setForm({...form, service_fee: parseFloat(e.target.value)})} />
                             <Input label="Service Fee % (of Total Sales)" type="number" value={form.service_fee_percentage || 0} onChange={e => setForm({...form, service_fee_percentage: parseFloat(e.target.value)})} />
                             
                             <div className="flex items-center gap-2 mt-6">
                                <input type="checkbox" checked={form.is_primary} onChange={e => setForm({...form, is_primary: e.target.checked})} className="h-4 w-4 rounded border-zinc-300 text-accent focus:ring-accent" />
                                <label className="text-sm">Set as Primary Country (Base for Calculations)</label>
                             </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-4">
                            <Button variant="ghost" onClick={() => { setShowAdd(false); setEditingCountry(null); }}>Cancel</Button>
                            <Button variant="primary" onClick={handleSave}>Save Configuration</Button>
                        </div>
                    </Card>
                )}

                <div className="space-y-4">
                    {countries.map(c => (
                        <Card key={c.id} className="flex flex-col md:flex-row justify-between items-center p-4 gap-4">
                            <div>
                                <div className="font-medium flex items-center gap-2">
                                   {c.name} <Badge>{c.code}</Badge> {c.is_primary && <Badge variant="success">Primary</Badge>}
                                </div>
                                <div className="text-xs text-zinc-500 mt-1">Currency: {c.currency_code}</div> 
                                <div className="text-xs text-zinc-500">Fees: {c.service_fee} + {c.service_fee_percentage || 0}%</div>
                            </div>
                            <div className="flex gap-4 items-center w-full md:w-auto justify-between md:justify-end">
                                <div className="text-right">
                                    <div className="text-xs text-zinc-400">1 USD =</div>
                                    <div className="font-mono text-sm font-bold">
                                        {(1/c.exchange_rate_to_usd).toFixed(2)} {c.currency_code}
                                    </div>
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => startEdit(c)}><Edit3 size={14} /></Button>
                                {!c.is_primary && <Button variant="ghost" size="sm" onClick={() => deleteCountry(c.id)} className="text-red-500 hover:text-red-600"><Trash2 size={14} /></Button>}
                            </div>
                        </Card>
                    ))}
                </div>
            </section>
        </div>
    )
}

// --- Profile Page ---
function ProfilePage() {
    const { user } = useGlobal();
    const navigate = useNavigate();

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <h1 className="text-2xl font-light">Profile</h1>
            <Card className="flex flex-col items-center p-8">
                <div className="w-20 h-20 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
                    <UserCircle size={40} className="text-zinc-400" />
                </div>
                <h2 className="text-xl font-medium">{user?.email}</h2>
                <p className="text-zinc-500 text-sm mb-6">Administrator</p>
                <Button 
                    variant="secondary" 
                    className="w-full text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                    onClick={() => supabase.auth.signOut()}
                >
                    <LogOut size={16} className="mr-2" /> Sign Out
                </Button>
            </Card>
        </div>
    )
}

// --- Auth Page ---
function AuthPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const { error } = isLogin 
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
      
      if (error) throw error;
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#09090b] p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
           <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-accent to-purple-400 mx-auto flex items-center justify-center text-white font-bold text-lg shadow-xl shadow-accent/20 mb-4">
            CP
          </div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">Welcome back</h1>
          <p className="text-zinc-500 mt-2">Enter your credentials to access your dashboard.</p>
        </div>
        
        <Card>
          <form onSubmit={handleAuth} className="space-y-4">
            <Input label="Email" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
            <Input label="Password" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
            
            {error && <div className="p-3 bg-red-500/10 text-red-500 text-xs rounded-md border border-red-500/20">{error}</div>}
            
            <Button type="submit" variant="primary" className="w-full h-11 text-base">
              {isLogin ? 'Sign In' : 'Create Account'}
            </Button>
          </form>
          
          <div className="mt-6 text-center">
            <button 
              type="button"
              className="text-sm text-zinc-500 hover:text-accent transition-colors"
              onClick={() => setIsLogin(!isLogin)}
            >
              {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}