import React, { useState, useEffect, useMemo, createContext, useContext, useRef } from 'react';
import { HashRouter as Router, Routes, Route, NavLink, useLocation, Navigate, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Package, ShoppingBag, Megaphone, 
  Wallet, Settings, BarChart3, Moon, Sun, Plus, 
  FileSpreadsheet, Upload, Trash2, ArrowRight, UserCircle, LogOut,
  Filter, Calendar, ChevronDown, X, Save, Edit3, Search, MoreHorizontal, CheckCircle, AlertCircle,
  TrendingUp, Truck, DollarSign, CreditCard, Image as ImageIcon, Download, TestTube, StickyNote
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, 
  LineChart, Line, Legend, AreaChart, Area, ComposedChart
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

  if (filter === 'custom' && customStart && customEnd) return { start: customStart, end: customEnd };
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

const formatCurrency = (amount: number, currency: 'USD' | 'MAD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    currencyDisplay: 'code', // Shows USD 1,234.00
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

const downloadTemplate = (type: 'ADS' | 'CHARGES_FIXED' | 'CHARGES_TEST') => {
    let data: any[] = [];
    let name = "template";
    if (type === 'ADS') {
        data = [{ Date: "2023-10-25", Platform: "Facebook", Amount: 150.50, Product: "Smart Watch", Country: "MA" }];
        name = "ads_spend_template";
    } else if (type === 'CHARGES_FIXED') {
        data = [{ Date: "2023-10-01", Description: "Office Rent", Product: "Smart Watch", Amount: 500, Country: "MA" }];
        name = "fixed_charges_template";
    } else {
        data = [{ Date: "2023-10-05", Platform: "TikTok Test", Product: "Smart Watch", Amount: 50, Country: "MA", Note: "Initial Test" }];
        name = "test_charges_template";
    }
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, `${name}.xlsx`);
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
  addSales: (s: Sale[]) => void;
  updateSale: (s: Sale) => void;
  deleteSale: (id: string) => void;
  deleteSalesForProduct: (productId: string) => void;

  addExpense: (e: Expense) => void;
  addExpenses: (e: Expense[]) => void;
  updateExpense: (e: Expense) => void;
  deleteExpense: (id: string) => void;
  deleteExpensesForProduct: (productId: string) => void;

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
];

const MOCK_PRODUCTS: Product[] = [
  { id: '1', name: 'Smart Watch Ultra', price_production: 15, price_shipping: 5, countries: ['MA'], note: 'Best seller' },
];

const MOCK_SALES: Sale[] = [
  { id: '1', date: '2023-10-24', full_name: 'Ahmed Bennani', phone: '0600000000', product_id: '1', quantity: 1, total_price: 499, delivery_price: 30, status: OrderStatus.DELIVERED, country: 'MA' },
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
  const addProduct = (p: Product) => setProducts(prev => [...prev, p]);
  const updateProduct = (p: Product) => setProducts(prev => prev.map(x => x.id === p.id ? p : x));
  const deleteProduct = (id: string) => setProducts(prev => prev.filter(x => x.id !== id));

  const addSale = (s: Sale) => setSales(prev => [...prev, s]);
  const addSales = (newSales: Sale[]) => setSales(prev => [...prev, ...newSales]);
  const updateSale = (s: Sale) => setSales(prev => prev.map(x => x.id === s.id ? s : x));
  const deleteSale = (id: string) => setSales(prev => prev.filter(x => x.id !== id));
  const deleteSalesForProduct = (productId: string) => setSales(prev => prev.filter(s => s.product_id !== productId));

  const addExpense = (e: Expense) => setExpenses(prev => [...prev, e]);
  const addExpenses = (newExpenses: Expense[]) => setExpenses(prev => [...prev, ...newExpenses]);
  const updateExpense = (e: Expense) => setExpenses(prev => prev.map(x => x.id === e.id ? e : x));
  const deleteExpense = (id: string) => setExpenses(prev => prev.filter(x => x.id !== id));
  const deleteExpensesForProduct = (productId: string) => setExpenses(prev => prev.filter(e => e.product_id !== productId));

  const addCountry = (c: CountrySettings) => {
      if (c.is_primary) {
          setCountries(prev => [...prev.map(x => ({...x, is_primary: false})), c]);
      } else {
          setCountries(prev => [...prev, c]);
      }
  };
  const updateCountry = (c: CountrySettings) => {
    setCountries(prev => {
      let updated = prev.map(country => country.id === c.id ? c : country);
      if (c.is_primary) {
          updated = updated.map(u => u.id === c.id ? u : { ...u, is_primary: false });
      }
      return updated;
    });
  };
  const deleteCountry = (id: string) => setCountries(prev => prev.filter(x => x.id !== id));
  
  const refreshData = () => { /* Fetch from Supabase */ };

  const value = {
    darkMode, toggleDarkMode, currency, setCurrency,
    products, sales, expenses, countries,
    refreshData, 
    addProduct, updateProduct, deleteProduct,
    addSale, addSales, updateSale, deleteSale, deleteSalesForProduct,
    addExpense, addExpenses, updateExpense, deleteExpense, deleteExpensesForProduct,
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
            <Route path="/charges-fixed" element={<FixedChargesPage />} />
            <Route path="/charges-test" element={<TestChargesPage />} />
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
    { icon: Wallet, label: 'Fixed Charges', path: '/charges-fixed' },
    { icon: TestTube, label: 'Test Charges', path: '/charges-test' },
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
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-zinc-900 text-white text-xs p-3 rounded-lg shadow-xl border border-zinc-800">
        <p className="font-semibold mb-2 text-zinc-400">{label}</p>
        {payload.map((p: any) => (
          <div key={p.name} className="flex items-center justify-between gap-4 mb-1">
            <div className="flex items-center gap-2">
               <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
               <span className="capitalize text-zinc-300">{p.name}:</span>
            </div>
            <span className="font-mono font-bold">{p.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

function Dashboard() {
  const { sales, expenses, products, currency, setCurrency, countries } = useGlobal();
  
  // Filters
  const [dateFilter, setDateFilter] = useState('this_month');
  const [customStart, setCustomStart] = useState(formatDate(new Date()));
  const [customEnd, setCustomEnd] = useState(formatDate(new Date()));
  const [selectedCountry, setSelectedCountry] = useState('all');
  const [selectedProduct, setSelectedProduct] = useState('all');
  const { start, end } = getDateRange(dateFilter, customStart, customEnd);

  const getLocalToDisplayRate = (countryCode: string) => {
    const country = countries.find(c => c.code === countryCode);
    if (!country) return 0;
    const rateLocalToUSD = country.exchange_rate_to_usd || 0;
    if (currency === 'USD') return rateLocalToUSD;
    const madCountry = countries.find(c => c.code === 'MA');
    const madRateToUSD = madCountry?.exchange_rate_to_usd || 0.1;
    if (madRateToUSD === 0) return 0; 
    return rateLocalToUSD * (1 / madRateToUSD);
  };

  const getUsdToDisplayRate = () => {
    if (currency === 'USD') return 1;
    const madCountry = countries.find(c => c.code === 'MA');
    const madRateToUSD = madCountry?.exchange_rate_to_usd || 0.1; 
    if (madRateToUSD === 0) return 0;
    return 1 / madRateToUSD;
  };

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

  let totalSales = 0;
  let totalStockCost = 0;
  const usdRate = getUsdToDisplayRate();

  filteredSales.forEach(s => {
    const localRate = getLocalToDisplayRate(s.country);
    totalSales += s.total_price * localRate;
    const product = products.find(p => p.id === s.product_id);
    if (product) {
       const productCostUsd = (product.price_production + product.price_shipping);
       totalStockCost += (productCostUsd * s.quantity) * usdRate;
    }
  });

  let totalAds = 0;
  let totalFixed = 0;
  let totalTest = 0;
  let totalServiceFees = 0;

  filteredSales.forEach(s => {
      const localRate = getLocalToDisplayRate(s.country);
      totalServiceFees += s.delivery_price * localRate;
  });

  filteredExpenses.forEach(e => {
    const val = e.amount * usdRate;
    if (e.type === 'ADS') totalAds += val;
    if (e.type === 'FIXED') totalFixed += val;
    if (e.type === 'TEST') totalTest += val;
  });

  const profit = totalSales - totalStockCost - totalServiceFees - totalAds - totalFixed - totalTest;
  const currencySymbol = currency === 'USD' ? '$' : 'DH';

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
       const costUsd = prod ? (prod.price_production + prod.price_shipping) : 0;
       const costVal = costUsd * s.quantity * usdRate;
       const fees = s.delivery_price * localRate;
       const pVal = sVal - costVal - fees;
       addData(s.date, sVal, pVal);
    });

    filteredExpenses.forEach(e => {
       addData(e.date, 0, -(e.amount * usdRate));
    });

    return Array.from(dateMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredSales, filteredExpenses, currency, products, countries]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
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
                    <option value="custom">Custom Date</option>
                 </select>
             </div>

             {dateFilter === 'custom' && (
                <div className="flex gap-1 items-center">
                    <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1.5 text-sm" />
                    <span className="text-zinc-400">-</span>
                    <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1.5 text-sm" />
                </div>
             )}

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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Sales" value={formatCurrency(totalSales, currency)} subValue={`${filteredSales.length} Orders`} icon={ShoppingBag} color="text-indigo-500" />
        <StatCard title="Total Spend" value={formatCurrency(totalStockCost + totalAds + totalServiceFees + totalFixed + totalTest, currency)} subValue="All Expenses" icon={Wallet} color="text-rose-500" />
        <StatCard title="Ads Spend" value={formatCurrency(totalAds, currency)} subValue="Marketing" icon={Megaphone} color="text-blue-500" />
        <StatCard title="Net Profit" value={formatCurrency(profit, currency)} subValue={`${totalSales > 0 ? ((profit/totalSales)*100).toFixed(1) : 0}% Margin`} icon={BarChart3} color={profit >= 0 ? "text-emerald-500" : "text-red-500"} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
         <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
             <div className="text-xs text-zinc-500 uppercase font-medium">Stock Cost</div>
             <div className="text-lg font-bold mt-1 text-zinc-900 dark:text-white">{formatCurrency(totalStockCost, currency)}</div>
         </div>
         <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
             <div className="text-xs text-zinc-500 uppercase font-medium">Service Fees</div>
             <div className="text-lg font-bold mt-1 text-zinc-900 dark:text-white">{formatCurrency(totalServiceFees, currency)}</div>
         </div>
         <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
             <div className="text-xs text-zinc-500 uppercase font-medium">Fixed Charges</div>
             <div className="text-lg font-bold mt-1 text-zinc-900 dark:text-white">{formatCurrency(totalFixed, currency)}</div>
         </div>
         <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
             <div className="text-xs text-zinc-500 uppercase font-medium">Test Charges</div>
             <div className="text-lg font-bold mt-1 text-zinc-900 dark:text-white">{formatCurrency(totalTest, currency)}</div>
         </div>
      </div>

      <Card className="h-[450px] p-0 overflow-hidden relative border-none ring-1 ring-zinc-200 dark:ring-zinc-800 shadow-lg">
          <div className="absolute top-6 left-6 z-10">
            <h3 className="font-medium text-lg">Profit & Sales Trend</h3>
            <p className="text-xs text-zinc-500">Daily performance breakdown</p>
          </div>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 80, right: 20, left: 0, bottom: 0 }}>
              <defs>
                 <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
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
              <Bar dataKey="sales" barSize={24} fill="#6366f1" radius={[6, 6, 0, 0]} />
              <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={3} fill="url(#profitGradient)" dot={{r: 4, strokeWidth: 2, fill: "#fff"}} activeDot={{r: 6}} />
            </ComposedChart>
          </ResponsiveContainer>
      </Card>
    </div>
  );
}

// --- Sales Page ---
function SalesPage() {
  const { sales, addSale, addSales, updateSale, deleteSale, products, countries } = useGlobal();
  const [mode, setMode] = useState<'list' | 'import' | 'manual'>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const defaultCountry = countries.length > 0 ? countries[0].code : 'MA';
  const [form, setForm] = useState<Partial<Sale>>({
    date: formatDate(new Date()),
    status: OrderStatus.PROCESSED,
    quantity: 1,
    country: defaultCountry
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importData, setImportData] = useState<any[]>([]);
  const [selectedImportCountry, setSelectedImportCountry] = useState(defaultCountry);
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
    const newSales: Sale[] = [];
    let count = 0;
    let skipped = 0;
    let duplicates = 0;

    importData.forEach((row: any) => {
       const getVal = (field: string) => {
          const colLetter = mapping[field];
          if (!colLetter) return undefined;
          return row[colLetter];
       };
       const dateVal = getVal('Date');
       const totalVal = getVal('Total Price');
       const prodName = getVal('Product');
       if (!dateVal || String(dateVal).toLowerCase().includes('date') || !totalVal) {
          skipped++;
          return;
       }
       
       let dateStr = formatDate(new Date());
       if (typeof dateVal === 'number') {
           const dateObj = new Date(Math.round((dateVal - 25569)*86400*1000));
           dateStr = formatDate(dateObj);
       } else {
           const d = new Date(String(dateVal));
           if (!isNaN(d.getTime())) {
               dateStr = formatDate(d);
           }
       }

       const full_name = String(getVal('Full Name') || 'Unknown');
       const phone = String(getVal('Phone') || '');
       const quantity = Number(getVal('Quantity')) || 1;
       const total_price = Number(totalVal) || 0;
       
       const targetName = String(prodName || '').trim().toLowerCase();
       const prod = products.find(p => p.name.trim().toLowerCase() === targetName);
       if (!prod) {
           skipped++;
           return; 
       }

       // Duplicate Check
       const isDuplicate = sales.some(s => s.date === dateStr && s.total_price === total_price && s.phone === phone && s.product_id === prod.id);
       if (isDuplicate) {
           duplicates++;
           return;
       }

       const statusRaw = getVal('Status');
       const status = (statusRaw as OrderStatus) || OrderStatus.PROCESSED;
       const delivery_price = calculateFees(selectedImportCountry, total_price);

       newSales.push({
          id: generateId(),
          date: dateStr,
          full_name,
          phone,
          product_id: prod.id,
          quantity,
          total_price,
          delivery_price,
          status,
          country: selectedImportCountry
       });
       count++;
    });

    if (newSales.length > 0) {
        addSales(newSales);
        let msg = `Successfully imported ${count} orders.`;
        if (duplicates > 0) msg += ` ${duplicates} duplicates skipped.`;
        if (skipped > 0) msg += ` ${skipped} rows skipped (invalid/missing product).`;
        alert(msg);
        setMode('list');
        setImportData([]);
    } else {
        let msg = "No valid new sales found.";
        if (duplicates > 0) msg += ` ${duplicates} duplicates detected and skipped.`;
        alert(msg);
    }
  };

  const saveMapping = () => {
    localStorage.setItem('sales_import_mapping', JSON.stringify(mapping));
    alert('Mapping saved!');
  };

  const handleSave = () => {
     // Duplicate check for manual entry
     if (!editingId) {
         const isDuplicate = sales.some(s => s.date === form.date && s.total_price === Number(form.total_price) && s.phone === form.phone && s.product_id === form.product_id);
         if (isDuplicate) {
             alert("Duplicate sale detected (Same Date, Price, Phone, Product). Entry skipped.");
             return;
         }
     }

     const delivery_price = calculateFees(form.country!, Number(form.total_price));
     const payload = {
       ...form,
       delivery_price: delivery_price, 
       total_price: Number(form.total_price),
       quantity: Number(form.quantity),
     } as Sale;
     if (editingId) updateSale({ ...payload, id: editingId });
     else addSale({ ...payload, id: generateId() });
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
                  <Button variant="primary" onClick={processImport}>Import Valid Rows</Button>
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
  const { products, addProduct, updateProduct, deleteProduct, countries, sales, expenses, deleteSalesForProduct, deleteExpensesForProduct } = useGlobal();
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Product>>({
    name: '',
    price_production: 0,
    price_shipping: 0,
    countries: [],
    note: '',
    image: ''
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              setForm(prev => ({ ...prev, image: reader.result as string }));
          };
          reader.readAsDataURL(file);
      }
  };

  const toggleCountry = (code: string) => {
      const current = form.countries || [];
      if (current.includes(code)) {
          setForm({...form, countries: current.filter(c => c !== code)});
      } else {
          setForm({...form, countries: [...current, code]});
      }
  };

  const handleSubmit = () => {
    if (!form.name) return;
    const payload = {
        id: currentId || generateId(),
        name: form.name,
        price_production: Number(form.price_production),
        price_shipping: Number(form.price_shipping),
        countries: form.countries || [],
        note: form.note || '',
        image: form.image || ''
    } as Product;
    if (currentId) updateProduct(payload);
    else addProduct(payload);
    setIsEditing(false);
    setCurrentId(null);
    setForm({ name: '', price_production: 0, price_shipping: 0, countries: [], note: '', image: '' });
  };

  const handleEdit = (p: Product) => {
    setForm(p);
    setCurrentId(p.id);
    setIsEditing(true);
  };

  const handleDelete = (id: string) => {
    const pSales = sales.filter(s => s.product_id === id);
    const pExpenses = expenses.filter(e => e.product_id === id);
    
    if (pSales.length > 0 || pExpenses.length > 0) {
        if (!confirm(`This product has ${pSales.length} sales and ${pExpenses.length} expenses associated with it. Deleting it will PERMANENTLY delete these records. Continue?`)) {
            return;
        }
        deleteSalesForProduct(id);
        deleteExpensesForProduct(id);
    }
    
    deleteProduct(id);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-light">Stock Inventory</h1>
        <Button onClick={() => setIsEditing(true)} variant="accent"><Plus size={16} className="mr-2"/> Add Product</Button>
      </div>
      {isEditing && (
        <Card className="max-w-2xl mx-auto animate-in fade-in slide-in-from-top-4">
             <h3 className="text-lg font-medium mb-4">{currentId ? 'Edit Product' : 'Add New Product'}</h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                    <Input label="Product Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Smart Watch" />
                </div>
                <Input label="Production Price (USD)" type="number" value={form.price_production} onChange={e => setForm({...form, price_production: parseFloat(e.target.value)})} />
                <Input label="Shipping Price (USD)" type="number" value={form.price_shipping} onChange={e => setForm({...form, price_shipping: parseFloat(e.target.value)})} />
                
                <div className="md:col-span-2">
                    <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider ml-1 mb-2 block">Available In Countries</label>
                    <div className="flex flex-wrap gap-2">
                        {countries.map(c => (
                            <div 
                                key={c.code} 
                                onClick={() => toggleCountry(c.code)}
                                className={`cursor-pointer px-3 py-1.5 rounded-full border text-xs font-medium transition-all select-none ${
                                    form.countries?.includes(c.code) 
                                    ? 'bg-accent text-white border-accent' 
                                    : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400'
                                }`}
                            >
                                {c.name}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="md:col-span-2">
                    <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider ml-1 mb-1 block">Product Image</label>
                    <div className="flex items-center gap-4">
                        <div onClick={() => fileInputRef.current?.click()} className="w-20 h-20 rounded-lg border-2 border-dashed border-zinc-300 dark:border-zinc-700 flex items-center justify-center cursor-pointer hover:border-accent hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors overflow-hidden relative">
                            {form.image ? (
                                <img src={form.image} className="w-full h-full object-cover" />
                            ) : (
                                <ImageIcon className="text-zinc-400" size={24}/>
                            )}
                        </div>
                        <div className="text-xs text-zinc-500">
                             <p>Click to upload a mini image.</p>
                             <p>Stored as Base64 (Keep it small)</p>
                        </div>
                        <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" />
                    </div>
                </div>
                <Input label="Note (Optional)" value={form.note} onChange={e => setForm({...form, note: e.target.value})} className="md:col-span-2" />
             </div>
             <div className="flex justify-end gap-2 mt-6">
                 <Button variant="ghost" onClick={() => { setIsEditing(false); setCurrentId(null); }}>Cancel</Button>
                 <Button onClick={handleSubmit}>Save Product</Button>
             </div>
        </Card>
      )}
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500">
                <tr>
                    <th className="px-6 py-4 font-semibold w-20">Image</th>
                    <th className="px-6 py-4 font-semibold">Product Name</th>
                    <th className="px-6 py-4 font-semibold">Markets</th>
                    <th className="px-6 py-4 font-semibold">Production</th>
                    <th className="px-6 py-4 font-semibold">Shipping</th>
                    <th className="px-6 py-4 font-semibold">Total Cost</th>
                    <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/50">
                {products.map(p => (
                    <tr key={p.id} className="group hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                        <td className="px-6 py-3">
                            <div className="w-10 h-10 rounded bg-zinc-100 dark:bg-zinc-800 overflow-hidden flex items-center justify-center">
                                {p.image ? <img src={p.image} className="w-full h-full object-cover"/> : <Package size={16} className="text-zinc-400"/>}
                            </div>
                        </td>
                        <td className="px-6 py-3 font-medium text-zinc-900 dark:text-zinc-100">{p.name}</td>
                        <td className="px-6 py-3">
                            <div className="flex gap-1 flex-wrap max-w-[150px]">
                                {p.countries?.map(c => <Badge key={c}>{c}</Badge>)}
                            </div>
                        </td>
                        <td className="px-6 py-3 text-zinc-500">${p.price_production}</td>
                        <td className="px-6 py-3 text-zinc-500">${p.price_shipping}</td>
                        <td className="px-6 py-3 font-mono font-bold text-accent">${(p.price_production + p.price_shipping).toFixed(2)}</td>
                        <td className="px-6 py-3 text-right">
                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleEdit(p)} className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded text-zinc-400 hover:text-accent"><Edit3 size={14}/></button>
                                <button onClick={() => handleDelete(p.id)} className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-zinc-400 hover:text-red-500"><Trash2 size={14}/></button>
                            </div>
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
    const { expenses, addExpense, updateExpense, deleteExpense, addExpenses, products, countries } = useGlobal();
    const [mode, setMode] = useState<'list' | 'import' | 'manual'>('list');
    const [currentId, setCurrentId] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // Filters
    const [dateFilter, setDateFilter] = useState('this_month');
    const [customStart, setCustomStart] = useState(formatDate(new Date()));
    const [customEnd, setCustomEnd] = useState(formatDate(new Date()));
    const { start, end } = getDateRange(dateFilter, customStart, customEnd);

    const adsExpenses = expenses.filter(e => {
        return e.type === 'ADS' && e.date >= start && e.date <= end;
    });

    const [form, setForm] = useState<Partial<Expense>>({
        date: formatDate(new Date()),
        amount: 0,
        type: 'ADS',
        platform: 'Facebook',
        product_id: products[0]?.id || '',
        country: countries[0]?.code || 'MA',
    });

    const handleSubmit = () => {
        if (!currentId) {
            const isDuplicate = expenses.some(e => e.type === 'ADS' && e.date === form.date && e.amount === Number(form.amount) && e.platform === form.platform);
            if (isDuplicate) {
                alert("Duplicate ad spend entry detected (Same Date, Amount, Platform). Entry skipped.");
                return;
            }
        }

        const payload = {
            ...form,
            id: currentId || generateId(),
            amount: Number(form.amount),
            type: 'ADS',
        } as Expense;
        if (currentId) updateExpense(payload);
        else addExpense(payload);
        setMode('list');
        setCurrentId(null);
        setForm({ date: formatDate(new Date()), amount: 0, type: 'ADS', platform: 'Facebook', product_id: products[0]?.id || '', country: countries[0]?.code || 'MA' });
    };

    const handleEdit = (e: Expense) => {
        setForm(e);
        setCurrentId(e.id);
        setMode('manual');
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const data: any[] = XLSX.utils.sheet_to_json(ws);
            const newExpenses: Expense[] = [];
            let count = 0;
            let duplicates = 0;
            
            data.forEach(row => {
                 const dateRaw = row['Date'] || row['date'];
                 const amount = row['Amount'] || row['amount'] || row['Spend'];
                 if (!dateRaw || !amount) return; 
                 let dateStr = formatDate(new Date());
                 if (typeof dateRaw === 'number') {
                     dateStr = formatDate(new Date(Math.round((dateRaw - 25569)*86400*1000)));
                 } else {
                     dateStr = String(dateRaw).substring(0, 10);
                 }
                 const platform = row['Platform'] || 'Facebook';
                 
                 // Duplicate Check
                 const isDuplicate = expenses.some(e => e.type === 'ADS' && e.date === dateStr && e.amount === Number(amount) && e.platform === platform);
                 if (isDuplicate) {
                     duplicates++;
                     return;
                 }

                 const prodName = row['Product'] || row['product'];
                 const targetName = String(prodName || '').trim().toLowerCase();
                 const prod = products.find(p => p.name.trim().toLowerCase() === targetName);
                 const exp: Expense = {
                     id: generateId(),
                     date: dateStr,
                     amount: Number(amount),
                     type: 'ADS',
                     platform: platform,
                     country: row['Country'] || countries[0].code,
                     product_id: prod ? prod.id : '' 
                 };
                 newExpenses.push(exp);
                 count++;
            });
            if (count > 0) {
                addExpenses(newExpenses);
                let msg = `Imported ${count} ad spend entries.`;
                if (duplicates > 0) msg += ` ${duplicates} duplicates skipped.`;
                alert(msg);
                setMode('list');
            } else {
                let msg = "No valid entries.";
                if (duplicates > 0) msg += ` ${duplicates} duplicates detected.`;
                alert(msg);
            }
        };
        reader.readAsBinaryString(file);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h1 className="text-2xl font-light">Ads Spend</h1>
                <div className="flex flex-wrap gap-2 items-center">
                    {/* Filters */}
                    <div className="flex items-center gap-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-1.5">
                        <Calendar size={14} className="text-zinc-400 ml-1"/>
                        <select value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="bg-transparent text-sm focus:outline-none">
                            <option value="this_month">This Month</option>
                            <option value="last_month">Last Month</option>
                            <option value="all">All Time</option>
                            <option value="custom">Custom</option>
                        </select>
                        {dateFilter === 'custom' && (
                            <div className="flex items-center gap-1 border-l border-zinc-200 dark:border-zinc-700 pl-2">
                                <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="bg-transparent text-xs w-24"/>
                                <span className="text-zinc-400">-</span>
                                <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="bg-transparent text-xs w-24"/>
                            </div>
                        )}
                    </div>
                    
                    <Button variant="secondary" onClick={() => setMode('import')}><FileSpreadsheet size={16} className="mr-2"/> Import Excel</Button>
                    <Button onClick={() => { setCurrentId(null); setMode('manual'); }} variant="accent"><Plus size={16} className="mr-2"/> Record Ad Spend</Button>
                </div>
            </div>
            {mode === 'import' && (
                <Card className="animate-in fade-in zoom-in-95">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-medium">Import Ads Spend</h3>
                        <Button variant="ghost" onClick={() => downloadTemplate('ADS')} size="sm">
                            <Download size={14} className="mr-2"/> Download Template
                        </Button>
                    </div>
                    <div className="mb-8 text-center">
                        <input type="file" ref={fileInputRef} onChange={handleImport} accept=".xlsx, .xls" className="hidden" />
                        <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl p-12 hover:border-accent transition-colors cursor-pointer bg-zinc-50/50 dark:bg-zinc-900/50">
                            <Upload className="mx-auto h-12 w-12 text-zinc-400 mb-4" />
                            <h3 className="text-lg font-medium">Click to Upload Excel</h3>
                            <p className="text-sm text-zinc-500 mt-1">Columns: Date, Platform, Amount, Country, Product</p>
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <Button variant="ghost" onClick={() => setMode('list')}>Cancel</Button>
                    </div>
                </Card>
            )}
            {mode === 'manual' && (
                <Card className="max-w-2xl mx-auto animate-in fade-in slide-in-from-top-4">
                    <h3 className="text-lg font-medium mb-4">{currentId ? 'Edit Ad Spend' : 'New Ad Spend'}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="Date" type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
                        <Input label="Amount (USD)" type="number" value={form.amount} onChange={e => setForm({...form, amount: parseFloat(e.target.value)})} />
                        <Select label="Platform" value={form.platform} onChange={e => setForm({...form, platform: e.target.value})} options={[{value:'Facebook', label:'Facebook'}, {value:'TikTok', label:'TikTok'}, {value:'Google', label:'Google'}, {value:'Snapchat', label:'Snapchat'}]} />
                        <Select label="Product" value={form.product_id} onChange={e => setForm({...form, product_id: e.target.value})} options={products.map(p => ({value: p.id, label: p.name}))} />
                        <Select label="Country" value={form.country} onChange={e => setForm({...form, country: e.target.value})} options={countries.map(c => ({value: c.code, label: c.name}))} />
                    </div>
                    <div className="flex justify-end gap-2 mt-6">
                        <Button variant="ghost" onClick={() => { setMode('list'); setCurrentId(null); }}>Cancel</Button>
                        <Button onClick={handleSubmit}>Save Entry</Button>
                    </div>
                </Card>
            )}
            {mode === 'list' && (
                <Card className="p-0 overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800">
                            <tr>
                                <th className="px-6 py-4 font-semibold">Date</th>
                                <th className="px-6 py-4 font-semibold">Platform</th>
                                <th className="px-6 py-4 font-semibold">Product</th>
                                <th className="px-6 py-4 font-semibold">Country</th>
                                <th className="px-6 py-4 font-semibold text-right">Amount (USD)</th>
                                <th className="px-6 py-4 font-semibold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                            {adsExpenses.map(e => (
                                <tr key={e.id} className="group hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                                    <td className="px-6 py-4 text-zinc-500">{e.date}</td>
                                    <td className="px-6 py-4">{e.platform}</td>
                                    <td className="px-6 py-4">{products.find(p => p.id === e.product_id)?.name || 'Unknown'}</td>
                                    <td className="px-6 py-4"><Badge>{e.country}</Badge></td>
                                    <td className="px-6 py-4 text-right font-mono">${e.amount.toFixed(2)}</td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100">
                                            <button onClick={() => handleEdit(e)} className="hover:text-accent"><Edit3 size={14}/></button>
                                            <button onClick={() => deleteExpense(e.id)} className="hover:text-red-500"><Trash2 size={14}/></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {adsExpenses.length === 0 && (
                                <tr><td colSpan={6} className="px-6 py-8 text-center text-zinc-500">No records found for this period.</td></tr>
                            )}
                        </tbody>
                    </table>
                </Card>
            )}
        </div>
    );
}

// --- Charges Page Component Factory ---
const ChargesPageComponent = ({ 
    type, 
    title, 
    templateType 
}: { 
    type: 'FIXED' | 'TEST', 
    title: string, 
    templateType: 'CHARGES_FIXED' | 'CHARGES_TEST' 
}) => {
    const { expenses, addExpense, updateExpense, deleteExpense, addExpenses, countries, products } = useGlobal();
    const [mode, setMode] = useState<'list' | 'import' | 'manual'>('list');
    const [currentId, setCurrentId] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // Filters
    const [dateFilter, setDateFilter] = useState('this_month');
    const [customStart, setCustomStart] = useState(formatDate(new Date()));
    const [customEnd, setCustomEnd] = useState(formatDate(new Date()));
    const { start, end } = getDateRange(dateFilter, customStart, customEnd);

    const charges = expenses.filter(e => e.type === type && e.date >= start && e.date <= end);

    const [form, setForm] = useState<Partial<Expense>>({
        date: formatDate(new Date()),
        amount: 0,
        type: type,
        name: '',
        country: countries[0]?.code || 'MA',
        product_id: '',
        note: ''
    });

    const handleSubmit = () => {
        if (!currentId) {
            const isDuplicate = expenses.some(e => e.type === type && e.date === form.date && e.amount === Number(form.amount) && (e.name === form.name || e.platform === form.platform));
            if (isDuplicate) {
                alert("Duplicate charge detected. Entry skipped.");
                return;
            }
        }

        const payload = {
            ...form,
            id: currentId || generateId(),
            amount: Number(form.amount),
            type: type
        } as Expense;
        if (currentId) updateExpense(payload);
        else addExpense(payload);
        setMode('list');
        setCurrentId(null);
        setForm({ date: formatDate(new Date()), amount: 0, type: type, name: '', country: countries[0]?.code || 'MA', product_id: '', note: '' });
    };

    const handleEdit = (e: Expense) => {
        setForm(e);
        setCurrentId(e.id);
        setMode('manual');
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
             const bstr = evt.target?.result;
             const wb = XLSX.read(bstr, { type: 'binary' });
             const ws = wb.Sheets[wb.SheetNames[0]];
             const data: any[] = XLSX.utils.sheet_to_json(ws);
             const newExpenses: Expense[] = [];
             let count = 0;
             let duplicates = 0;
             data.forEach(row => {
                 const dateRaw = row['Date'] || row['date'];
                 const amount = row['Amount'] || row['amount'];
                 if (!dateRaw || !amount) return;
                 let dateStr = formatDate(new Date());
                 if (typeof dateRaw === 'number') {
                     dateStr = formatDate(new Date(Math.round((dateRaw - 25569)*86400*1000)));
                 } else {
                     dateStr = String(dateRaw).substring(0, 10);
                 }
                 
                 const nameOrPlat = type === 'FIXED' ? (row['Description'] || row['Name'] || '') : (row['Platform'] || '');
                 const isDuplicate = expenses.some(e => e.type === type && e.date === dateStr && e.amount === Number(amount) && (e.name === nameOrPlat || e.platform === nameOrPlat));
                 if (isDuplicate) {
                     duplicates++;
                     return;
                 }

                 const prodName = row['Product'] || row['product'];
                 const targetName = String(prodName || '').trim().toLowerCase();
                 const prod = products.find(p => p.name.trim().toLowerCase() === targetName);
                 newExpenses.push({
                     id: generateId(),
                     date: dateStr,
                     amount: Number(amount),
                     type: type,
                     name: type === 'FIXED' ? nameOrPlat : '',
                     platform: type === 'TEST' ? nameOrPlat : '',
                     country: row['Country'] || countries[0].code,
                     product_id: prod ? prod.id : '',
                     note: row['Note'] || ''
                 });
                 count++;
             });
             if (count > 0) {
                 addExpenses(newExpenses);
                 let msg = `Imported ${count} charges.`;
                 if (duplicates > 0) msg += ` ${duplicates} duplicates skipped.`;
                 alert(msg);
                 setMode('list');
             } else {
                 let msg = "No valid entries.";
                 if (duplicates > 0) msg += ` ${duplicates} duplicates detected.`;
                 alert(msg);
             }
        };
        reader.readAsBinaryString(file);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h1 className="text-2xl font-light">{title}</h1>
                <div className="flex flex-wrap gap-2 items-center">
                    {/* Filters */}
                    <div className="flex items-center gap-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-1.5">
                        <Calendar size={14} className="text-zinc-400 ml-1"/>
                        <select value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="bg-transparent text-sm focus:outline-none">
                            <option value="this_month">This Month</option>
                            <option value="last_month">Last Month</option>
                            <option value="all">All Time</option>
                            <option value="custom">Custom</option>
                        </select>
                        {dateFilter === 'custom' && (
                            <div className="flex items-center gap-1 border-l border-zinc-200 dark:border-zinc-700 pl-2">
                                <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="bg-transparent text-xs w-24"/>
                                <span className="text-zinc-400">-</span>
                                <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="bg-transparent text-xs w-24"/>
                            </div>
                        )}
                    </div>

                    <Button variant="secondary" onClick={() => setMode('import')}><FileSpreadsheet size={16} className="mr-2"/> Import Excel</Button>
                    <Button onClick={() => { setCurrentId(null); setMode('manual'); }} variant="accent"><Plus size={16} className="mr-2"/> Add Charge</Button>
                </div>
            </div>
            {mode === 'import' && (
                <Card className="animate-in fade-in zoom-in-95">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-medium">Import {title}</h3>
                        <Button variant="ghost" onClick={() => downloadTemplate(templateType)} size="sm">
                            <Download size={14} className="mr-2"/> Download Template
                        </Button>
                    </div>
                    <div className="mb-8 text-center">
                        <input type="file" ref={fileInputRef} onChange={handleImport} accept=".xlsx, .xls" className="hidden" />
                        <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl p-12 hover:border-accent transition-colors cursor-pointer bg-zinc-50/50 dark:bg-zinc-900/50">
                            <Upload className="mx-auto h-12 w-12 text-zinc-400 mb-4" />
                            <h3 className="text-lg font-medium">Click to Upload Excel</h3>
                            <p className="text-sm text-zinc-500 mt-1">
                                Columns: Date, Amount, Country, Product, {type === 'FIXED' ? 'Description' : 'Platform'} {type === 'TEST' && ', Note'}
                            </p>
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <Button variant="ghost" onClick={() => setMode('list')}>Cancel</Button>
                    </div>
                </Card>
            )}
            {mode === 'manual' && (
                <Card className="max-w-2xl mx-auto animate-in fade-in slide-in-from-top-4">
                    <h3 className="text-lg font-medium mb-4">{currentId ? 'Edit Charge' : 'New Charge'}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="Date" type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
                        <Input label="Amount (USD)" type="number" value={form.amount} onChange={e => setForm({...form, amount: parseFloat(e.target.value)})} />
                        {type === 'FIXED' ? (
                             <Input label="Description" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Office Rent" />
                        ) : (
                             <Input label="Platform" value={form.platform} onChange={e => setForm({...form, platform: e.target.value})} placeholder="e.g. TikTok Test" />
                        )}
                        <Select label="Country" value={form.country} onChange={e => setForm({...form, country: e.target.value})} options={countries.map(c => ({value: c.code, label: c.name}))} />
                        <Select label="Product (Optional)" value={form.product_id} onChange={e => setForm({...form, product_id: e.target.value})} options={[{value:'', label:'No Product'}, ...products.map(p => ({value: p.id, label: p.name}))]} />
                        {type === 'TEST' && (
                            <Input label="Note" value={form.note || ''} onChange={e => setForm({...form, note: e.target.value})} placeholder="e.g. Initial test phase 1" className="md:col-span-2"/>
                        )}
                    </div>
                    <div className="flex justify-end gap-2 mt-6">
                        <Button variant="ghost" onClick={() => { setMode('list'); setCurrentId(null); }}>Cancel</Button>
                        <Button onClick={handleSubmit}>Save Charge</Button>
                    </div>
                </Card>
            )}
            {mode === 'list' && (
                <Card className="p-0 overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800">
                            <tr>
                                <th className="px-6 py-4 font-semibold">Date</th>
                                <th className="px-6 py-4 font-semibold">{type === 'FIXED' ? 'Description' : 'Platform'}</th>
                                <th className="px-6 py-4 font-semibold">Product</th>
                                <th className="px-6 py-4 font-semibold">Country</th>
                                {type === 'TEST' && <th className="px-6 py-4 font-semibold">Note</th>}
                                <th className="px-6 py-4 font-semibold text-right">Amount (USD)</th>
                                <th className="px-6 py-4 font-semibold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                            {charges.map(e => (
                                <tr key={e.id} className="group hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                                    <td className="px-6 py-4 text-zinc-500">{e.date}</td>
                                    <td className="px-6 py-4">{type === 'FIXED' ? e.name : e.platform || '-'}</td>
                                    <td className="px-6 py-4">{products.find(p => p.id === e.product_id)?.name || '-'}</td>
                                    <td className="px-6 py-4"><Badge>{e.country}</Badge></td>
                                    {type === 'TEST' && <td className="px-6 py-4 text-zinc-500 italic truncate max-w-[150px]">{e.note || '-'}</td>}
                                    <td className="px-6 py-4 text-right font-mono">${e.amount.toFixed(2)}</td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100">
                                            <button onClick={() => handleEdit(e)} className="hover:text-accent"><Edit3 size={14}/></button>
                                            <button onClick={() => deleteExpense(e.id)} className="hover:text-red-500"><Trash2 size={14}/></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                             {charges.length === 0 && (
                                <tr><td colSpan={7} className="px-6 py-8 text-center text-zinc-500">No records found.</td></tr>
                            )}
                        </tbody>
                    </table>
                </Card>
            )}
        </div>
    );
};

const FixedChargesPage = () => <ChargesPageComponent type="FIXED" title="Fixed Charges" templateType="CHARGES_FIXED" />;
const TestChargesPage = () => <ChargesPageComponent type="TEST" title="Test Charges" templateType="CHARGES_TEST" />;

// --- Analyze Products Page (Restored) ---
function AnalyzeProductsPage() {
    const { products, sales, expenses, currency, countries } = useGlobal();
    
    // Filters State
    const [dateRange, setDateRange] = useState<'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'custom'>('this_month');
    const [customStart, setCustomStart] = useState(formatDate(new Date()));
    const [customEnd, setCustomEnd] = useState(formatDate(new Date()));
    const [filterCountry, setFilterCountry] = useState('all');
    const [filterProduct, setFilterProduct] = useState('all');
    const [displayCurrency, setDisplayCurrency] = useState<'USD' | 'MAD'>('USD');

    const { start, end } = getDateRange(dateRange, customStart, customEnd);

    // Helpers
    const getLocalToDisplayRate = (countryCode: string) => {
        const country = countries.find(c => c.code === countryCode);
        if (!country) return 0;
        const rateLocalToUSD = country.exchange_rate_to_usd || 0;
        if (displayCurrency === 'USD') return rateLocalToUSD;
        const madCountry = countries.find(c => c.code === 'MA');
        const madRateToUSD = madCountry?.exchange_rate_to_usd || 0.1;
        return rateLocalToUSD * (1 / madRateToUSD);
    };

    const getUsdToDisplayRate = () => {
        if (displayCurrency === 'USD') return 1;
        const madCountry = countries.find(c => c.code === 'MA');
        const madRateToUSD = madCountry?.exchange_rate_to_usd || 0.1;
        return 1 / madRateToUSD;
    };

    const usdRate = getUsdToDisplayRate();
    const currencySym = displayCurrency === 'USD' ? '$' : 'DH';

    // Chart Data
    const chartData = useMemo(() => {
        const dayMap = new Map<string, { date: string, sales: number, profit: number, cost: number, ads: number }>();
        const initDay = (d: string) => {
            if (!dayMap.has(d)) dayMap.set(d, { date: d, sales: 0, profit: 0, cost: 0, ads: 0 });
        };

        const relevantSales = sales.filter(s => {
            if (filterProduct !== 'all' && s.product_id !== filterProduct) return false;
            if (filterCountry !== 'all' && s.country !== filterCountry) return false;
            return s.date >= start && s.date <= end;
        });

        const relevantExpenses = expenses.filter(e => {
            if (filterProduct !== 'all' && e.product_id !== filterProduct) return false;
            if (filterCountry !== 'all' && e.country !== filterCountry) return false;
            return e.date >= start && e.date <= end;
        });

        relevantSales.forEach(s => {
            initDay(s.date);
            const entry = dayMap.get(s.date)!;
            const rate = getLocalToDisplayRate(s.country);
            const revenue = s.total_price * rate;
            const fees = s.delivery_price * rate;
            const prod = products.find(p => p.id === s.product_id);
            const stock = prod ? (prod.price_production + prod.price_shipping) * s.quantity * usdRate : 0;
            entry.sales += revenue;
            entry.cost += stock + fees;
        });

        relevantExpenses.forEach(e => {
            initDay(e.date);
            const entry = dayMap.get(e.date)!;
            const amount = e.amount * usdRate;
            if (e.type === 'ADS') entry.ads += amount;
            else entry.cost += amount;
        });

        for (const val of dayMap.values()) {
            val.profit = val.sales - val.cost - val.ads;
        }

        return Array.from(dayMap.values()).sort((a,b) => a.date.localeCompare(b.date));
    }, [sales, expenses, products, start, end, filterProduct, filterCountry, displayCurrency, countries]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                 <div><h1 className="text-2xl font-light">Product Analysis</h1></div>
                 <div className="flex flex-wrap gap-2 items-center bg-white dark:bg-zinc-800 p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm w-full md:w-auto">
                      <div className="flex items-center gap-2 px-2">
                         <Filter size={14} className="text-zinc-400"/>
                         <select value={dateRange} onChange={e => setDateRange(e.target.value as any)} className="bg-transparent text-sm focus:outline-none">
                            <option value="today">Today</option>
                            <option value="yesterday">Yesterday</option>
                            <option value="this_week">This Week</option>
                            <option value="this_month">This Month</option>
                            <option value="custom">Custom Date</option>
                         </select>
                      </div>
                      {dateRange === 'custom' && (
                          <div className="flex gap-1">
                             <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1 text-xs" />
                             <span className="text-zinc-400">-</span>
                             <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1 text-xs" />
                          </div>
                      )}
                      <div className="w-[1px] h-4 bg-zinc-300 dark:bg-zinc-600 mx-1"></div>
                      <select value={filterCountry} onChange={e => setFilterCountry(e.target.value)} className="bg-transparent text-sm focus:outline-none max-w-[100px]">
                          <option value="all">All Countries</option>
                          {countries.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                      </select>
                      <select value={filterProduct} onChange={e => setFilterProduct(e.target.value)} className="bg-transparent text-sm focus:outline-none max-w-[100px]">
                          <option value="all">All Products</option>
                          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      <div className="w-[1px] h-4 bg-zinc-300 dark:bg-zinc-600 mx-1"></div>
                      <select value={displayCurrency} onChange={e => setDisplayCurrency(e.target.value as any)} className="bg-transparent text-sm font-bold text-accent focus:outline-none">
                          <option value="USD">USD</option>
                          <option value="MAD">MAD</option>
                      </select>
                 </div>
            </div>

            <Card className="h-[400px] p-0 overflow-hidden relative">
                 <div className="absolute top-6 left-6 z-10">
                    <h3 className="font-medium text-lg">Performance Trend</h3>
                    <p className="text-xs text-zinc-500">{filterProduct === 'all' ? 'All Products' : products.find(p => p.id === filterProduct)?.name}</p>
                 </div>
                 <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 80, right: 30, left: 10, bottom: 10 }}>
                      <defs>
                         <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                         </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#333" opacity={0.05} />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#a1a1aa', fontSize: 11}} dy={10} 
                             tickFormatter={(str) => {
                                 const d = new Date(str);
                                 return `${d.getDate()}/${d.getMonth()+1}`;
                             }}
                      />
                      <Tooltip 
                        contentStyle={{backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', color: '#fff'}}
                        itemStyle={{fontSize: '12px'}}
                        labelStyle={{color: '#a1a1aa', marginBottom: '8px', fontSize: '12px'}}
                        formatter={(value: any) => formatCurrency(value, displayCurrency)}
                      />
                      <Bar dataKey="sales" name="Sales" barSize={20} fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                      <Line type="monotone" dataKey="profit" name="Profit" stroke="#10b981" strokeWidth={2} dot={{r: 3}} />
                      <Area type="monotone" dataKey="ads" name="Ads Spend" stroke="#3b82f6" fill="none" strokeWidth={2} strokeDasharray="5 5" />
                    </ComposedChart>
                 </ResponsiveContainer>
            </Card>
        </div>
    );
}

// --- Settings Page ---
function SettingsPage() {
    const { countries, addCountry, updateCountry, deleteCountry } = useGlobal();
    const [showAdd, setShowAdd] = useState(false);
    const [editingCountry, setEditingCountry] = useState<CountrySettings | null>(null);
    const [form, setForm] = useState<Partial<CountrySettings>>({});

    const [usdInput, setUsdInput] = useState<string>(''); 
    const [madInput, setMadInput] = useState<string>(''); 

    const handleSave = () => {
        const payload = { ...form, id: editingCountry?.id || generateId() } as CountrySettings;
        if (editingCountry) updateCountry(payload);
        else addCountry(payload);
        
        setShowAdd(false);
        setEditingCountry(null);
        setForm({});
        setUsdInput('');
        setMadInput('');
    };

    const startEdit = (c: CountrySettings) => {
        setEditingCountry(c);
        setForm(c);
        
        // UI USD: 1 USD = (1/X) Local.
        if (c.exchange_rate_to_usd > 0) {
            setUsdInput((1 / c.exchange_rate_to_usd).toFixed(2));
            
            // UI MAD: 1 MAD = ? Local
            const ma = countries.find(x => x.code === 'MA');
            const maRate = ma?.exchange_rate_to_usd || 0.1; 
            setMadInput((maRate / c.exchange_rate_to_usd).toFixed(2));
        } else {
            setUsdInput('');
            setMadInput('');
        }
        setShowAdd(true);
    };

    const handleUsdEquivChange = (val: string) => {
        setUsdInput(val);
        const num = parseFloat(val);
        if (num > 0) {
            setForm(prev => ({ ...prev, exchange_rate_to_usd: 1 / num }));
        }
    };

    const handleMadEquivChange = (val: string) => {
        setMadInput(val);
        // This is just a helper for display/checking, logic prioritizes USD rate internally
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
                                    value={usdInput} 
                                    onChange={e => handleUsdEquivChange(e.target.value)} 
                                    placeholder="e.g. 680"
                                />
                                <Input 
                                    label={`1 MAD = ? ${form.currency_code || 'Local'}`} 
                                    type="number" 
                                    value={madInput} 
                                    onChange={e => handleMadEquivChange(e.target.value)} 
                                    placeholder="e.g. 68"
                                />
                                <p className="text-xs text-zinc-500 md:col-span-2">
                                    Manual rates entry. (Internal logic uses USD rate)
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  return (
    <div className="max-w-md mx-auto mt-10">
      <Card className="text-center p-8">
         <div className="w-20 h-20 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <UserCircle size={40} className="text-zinc-400"/>
         </div>
         <h2 className="text-xl font-bold mb-1">{user?.email}</h2>
         <p className="text-sm text-zinc-500 mb-6">User ID: {user?.id}</p>
         
         <div className="border-t border-zinc-100 dark:border-zinc-800 pt-6">
            <Button variant="secondary" onClick={handleLogout} className="w-full text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
               <LogOut size={16} className="mr-2"/> Sign Out
            </Button>
         </div>
      </Card>
    </div>
  );
}

// --- Auth Page ---
function AuthPage() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        alert('Check your email for the login link!');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#09090b] flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 shadow-2xl border-zinc-200 dark:border-zinc-800 animate-in fade-in zoom-in-95 duration-300">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-accent to-purple-400 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-accent/20 mx-auto mb-4">
            CP
          </div>
          <h1 className="text-2xl font-light text-zinc-900 dark:text-white mb-2">Welcome Back</h1>
          <p className="text-sm text-zinc-500">Sign in to your COD Profit dashboard</p>
        </div>
        
        <form onSubmit={handleAuth} className="space-y-4">
          <Input 
            label="Email Address" 
            type="email" 
            value={email} 
            onChange={e => setEmail(e.target.value)} 
            placeholder="name@company.com"
            required 
          />
          <Input 
            label="Password" 
            type="password" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            placeholder="••••••••"
            required 
          />
          
          <Button 
            className="w-full mt-6" 
            disabled={loading}
            variant="primary"
          >
            {loading ? 'Processing...' : (isSignUp ? 'Create Account' : 'Sign In')}
          </Button>
        </form>

        <div className="mt-8 text-center text-xs">
          <span className="text-zinc-500">
            {isSignUp ? "Already have an account? " : "Don't have an account? "}
          </span>
          <button 
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-accent font-medium hover:underline transition-colors"
          >
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </button>
        </div>
      </Card>
    </div>
  );
}