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

// --- Analyze Page ---
function AnalyzeProductsPage() {
  const { products, sales, expenses, currency, countries } = useGlobal();
  
  // Filters for chart and analysis
  const [dateRange, setDateRange] = useState<'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'custom'>('this_month');
  const [customStart, setCustomStart] = useState(formatDate(new Date()));
  const [customEnd, setCustomEnd] = useState(formatDate(new Date()));
  const [selectedCountry, setSelectedCountry] = useState('all');
  const [selectedProduct, setSelectedProduct] = useState('all'); // Allows single product selection

  const { start, end } = getDateRange(dateRange, customStart, customEnd);

  const getRate = (countryCode: string) => {
    const country = countries.find(c => c.code === countryCode);
    if (!country) return 0;
    const rateLocalToUSD = country.exchange_rate_to_usd || 0;
    if (currency === 'USD') return rateLocalToUSD;
    const madCountry = countries.find(c => c.code === 'MA');
    const madRateToUSD = madCountry?.exchange_rate_to_usd || 0.1;
    if (madRateToUSD === 0) return 0; 
    return rateLocalToUSD * (1 / madRateToUSD);
  };
  
  const usdDisplayRate = currency === 'USD' ? 1 : (1 / (countries.find(c => c.code === 'MA')?.exchange_rate_to_usd || 0.1));

  // --- Chart Data Logic ---
  const chartData = useMemo(() => {
      const dayMap = new Map<string, { date: string, sales: number, profit: number, cost: number, ads: number }>();
      
      // Helper to init day
      const initDay = (d: string) => {
          if (!dayMap.has(d)) dayMap.set(d, { date: d, sales: 0, profit: 0, cost: 0, ads: 0 });
      };

      // Filter
      const relevantSales = sales.filter(s => {
          if (selectedProduct !== 'all' && s.product_id !== selectedProduct) return false;
          if (selectedCountry !== 'all' && s.country !== selectedCountry) return false;
          return s.date >= start && s.date <= end;
      });

      const relevantExpenses = expenses.filter(e => {
          if (selectedProduct !== 'all' && e.product_id !== selectedProduct) return false;
          if (selectedCountry !== 'all' && e.country !== selectedCountry) return false;
          return e.date >= start && e.date <= end;
      });

      relevantSales.forEach(s => {
          initDay(s.date);
          const entry = dayMap.get(s.date)!;
          const rate = getRate(s.country);
          const revenue = s.total_price * rate;
          const fees = s.delivery_price * rate;
          
          const prod = products.find(p => p.id === s.product_id);
          const stock = prod ? (prod.price_production + prod.price_shipping) * s.quantity * usdDisplayRate : 0;

          entry.sales += revenue;
          entry.cost += stock + fees;
      });

      relevantExpenses.forEach(e => {
          initDay(e.date);
          const entry = dayMap.get(e.date)!;
          const amount = e.amount * usdDisplayRate;
          if (e.type === 'ADS') entry.ads += amount;
          else entry.cost += amount; // Charges as cost
      });

      // Calc profit per day
      for (const val of dayMap.values()) {
          val.profit = val.sales - val.cost - val.ads;
      }

      return Array.from(dayMap.values()).sort((a,b) => a.date.localeCompare(b.date));
  }, [sales, expenses, products, start, end, selectedProduct, selectedCountry, currency, countries]);

  // --- Table/Summary Logic ---
  const stats = useMemo(() => {
    // If a single product is selected, we just show that one product in the list/table logic
    // If all, we show list of all.
    const productsToShow = selectedProduct === 'all' ? products : products.filter(p => p.id === selectedProduct);

    return productsToShow.map(product => {
        const productSales = sales.filter(s => s.product_id === product.id && s.date >= start && s.date <= end && (selectedCountry === 'all' || s.country === selectedCountry));
        const productExpenses = expenses.filter(e => e.product_id === product.id && e.date >= start && e.date <= end && (selectedCountry === 'all' || e.country === selectedCountry));
        
        let revenue = 0;
        let fees = 0;
        let stockCost = 0;
  
        productSales.forEach(s => {
            const rate = getRate(s.country);
            revenue += s.total_price * rate;
            fees += s.delivery_price * rate;
            stockCost += (product.price_production + product.price_shipping) * s.quantity * usdDisplayRate;
        });
  
        let marketing = 0;
        let otherCharges = 0;
        productExpenses.forEach(e => {
            const amt = e.amount * usdDisplayRate;
            if (e.type === 'ADS') marketing += amt;
            else otherCharges += amt;
        });
  
        const profit = revenue - stockCost - fees - marketing - otherCharges;
        const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
        const roi = (stockCost + marketing + otherCharges) > 0 ? (profit / (stockCost + marketing + otherCharges)) * 100 : 0;
  
        return {
            ...product,
            revenue,
            profit,
            margin,
            roi,
            salesCount: productSales.length,
            ads: marketing,
            charges: otherCharges + fees + stockCost // Total Cost bucket for simple display
        };
    }).sort((a,b) => b.profit - a.profit);
  }, [products, sales, expenses, currency, countries, start, end, selectedProduct, selectedCountry]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h1 className="text-2xl font-light">Product Analysis</h1>
            
            {/* Filters */}
            <div className="flex flex-wrap gap-2 items-center bg-white dark:bg-zinc-800 p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm">
                 <div className="flex items-center gap-2 px-2 border-r border-zinc-200 dark:border-zinc-700">
                     <Calendar size={14} className="text-zinc-400"/>
                     <select value={dateRange} onChange={e => setDateRange(e.target.value as any)} className="bg-transparent text-sm focus:outline-none">
                        <option value="today">Today</option>
                        <option value="yesterday">Yesterday</option>
                        <option value="this_week">This Week</option>
                        <option value="this_month">This Month</option>
                        <option value="custom">Custom</option>
                     </select>
                 </div>
                 {dateRange === 'custom' && (
                    <div className="flex gap-1 items-center px-2 border-r border-zinc-200 dark:border-zinc-700">
                        <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="bg-transparent text-xs w-24"/>
                        <span className="text-zinc-400">-</span>
                        <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="bg-transparent text-xs w-24"/>
                    </div>
                 )}
                 <select value={selectedCountry} onChange={e => setSelectedCountry(e.target.value)} className="bg-transparent text-sm focus:outline-none px-2 border-r border-zinc-200 dark:border-zinc-700">
                      <option value="all">All Countries</option>
                      {countries.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                 </select>
                 <select value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)} className="bg-transparent text-sm focus:outline-none px-2 font-medium min-w-[120px]">
                      <option value="all">All Products</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                 </select>
            </div>
        </div>

        {/* Chart Section */}
        <Card className="h-[400px] p-0 overflow-hidden relative">
             <div className="absolute top-6 left-6 z-10">
                <h3 className="font-medium text-lg">Performance Trend</h3>
                <p className="text-xs text-zinc-500">{selectedProduct === 'all' ? 'All Products' : products.find(p => p.id === selectedProduct)?.name}</p>
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
                    formatter={(value: any) => formatCurrency(value, currency)}
                  />
                  <Bar dataKey="sales" name="Sales" barSize={20} fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  <Line type="monotone" dataKey="profit" name="Profit" stroke="#10b981" strokeWidth={2} dot={{r: 3}} />
                  <Area type="monotone" dataKey="ads" name="Ads Spend" stroke="#3b82f6" fill="none" strokeWidth={2} strokeDasharray="5 5" />
                </ComposedChart>
             </ResponsiveContainer>
        </Card>

        {/* Detailed Cards List */}
        <div className="grid grid-cols-1 gap-4">
            {stats.map(p => (
                <Card key={p.id} className="flex flex-col md:flex-row gap-6 items-center p-4">
                    <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center">
                         {p.image ? <img src={p.image} className="w-full h-full object-cover" /> : <Package className="text-zinc-400" size={24}/>}
                    </div>
                    <div className="flex-1 w-full text-center md:text-left">
                        <h3 className="text-lg font-medium">{p.name}</h3>
                        <p className="text-xs text-zinc-500">{p.salesCount} orders • {p.countries.join(', ')}</p>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 w-full md:w-auto text-center">
                         <div className="p-2 bg-zinc-50 dark:bg-zinc-900 rounded border border-zinc-100 dark:border-zinc-800 min-w-[100px]">
                             <div className="text-[10px] text-zinc-500 uppercase font-medium">Revenue</div>
                             <div className="font-mono font-bold text-sm">{formatCurrency(p.revenue, currency)}</div>
                         </div>
                         <div className="p-2 bg-zinc-50 dark:bg-zinc-900 rounded border border-zinc-100 dark:border-zinc-800 min-w-[100px]">
                             <div className="text-[10px] text-zinc-500 uppercase font-medium">Profit</div>
                             <div className={`font-mono font-bold text-sm ${p.profit >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                 {formatCurrency(p.profit, currency)}
                             </div>
                         </div>
                         <div className="p-2 bg-zinc-50 dark:bg-zinc-900 rounded border border-zinc-100 dark:border-zinc-800 min-w-[100px]">
                             <div className="text-[10px] text-zinc-500 uppercase font-medium">Margin</div>
                             <div className={`font-mono font-bold text-sm ${p.margin >= 20 ? 'text-emerald-500' : 'text-amber-500'}`}>
                                 {p.margin.toFixed(1)}%
                             </div>
                         </div>
                         <div className="p-2 bg-zinc-50 dark:bg-zinc-900 rounded border border-zinc-100 dark:border-zinc-800 min-w-[100px]">
                             <div className="text-[10px] text-zinc-500 uppercase font-medium">ROI</div>
                             <div className="font-mono font-bold text-sm">{p.roi.toFixed(1)}%</div>
                         </div>
                    </div>
                </Card>
            ))}
            {stats.length === 0 && <div className="text-center text-zinc-500 py-10">No data found for selection.</div>}
        </div>
    </div>
  );
}

// --- Settings Page ---
function SettingsPage() {
    const { countries, addCountry, updateCountry, deleteCountry } = useGlobal();
    const [showAdd, setShowAdd] = useState(false);
    const [editingCountry, setEditingCountry] = useState<CountrySettings | null>(null);
    const [form, setForm] = useState<Partial<CountrySettings>>({});

    // Manual inputs
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
        
        if (c.exchange_rate_to_usd > 0) {
            setUsdInput((1 / c.exchange_rate_to_usd).toFixed(2));
            // Show rough MAD estimate
            setMadInput((0.1 / c.exchange_rate_to_usd).toFixed(2));
        } else {
            setUsdInput('');
            setMadInput('');
        }
        setShowAdd(true);
    };

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
                             
                             <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 bg-zinc-50 dark:bg-zinc-800 p-4 rounded-lg">
                                <Input 
                                    label={`1 USD = ? ${form.currency_code || 'Local'}`} 
                                    type="number" 
                                    value={usdInput} 
                                    onChange={e => {
                                        setUsdInput(e.target.value);
                                        const val = parseFloat(e.target.value);
                                        if (val > 0) setForm({...form, exchange_rate_to_usd: 1/val});
                                    }} 
                                    placeholder="e.g. 600"
                                />
                                <Input 
                                    label={`1 MAD = ? ${form.currency_code || 'Local'}`} 
                                    type="number" 
                                    value={madInput} 
                                    onChange={e => setMadInput(e.target.value)} 
                                    placeholder="e.g. 60"
                                />
                                <p className="text-xs text-zinc-500 md:col-span-2">
                                    Enter conversion rates manually. 
                                </p>
                             </div>

                             <Input label="Fixed Service Fee (Local Currency)" type="number" value={form.service_fee} onChange={e => setForm({...form, service_fee: parseFloat(e.target.value)})} />
                             <Input label="Service Fee % (of Total Sales)" type="number" value={form.service_fee_percentage || 0} onChange={e => setForm({...form, service_fee_percentage: parseFloat(e.target.value)})} />
                             
                             <div className="flex items-center gap-2 mt-6">
                                <input type="checkbox" checked={form.is_primary} onChange={e => setForm({...form, is_primary: e.target.checked})} className="h-4 w-4 rounded border-zinc-300 text-accent focus:ring-accent" />
                                <label className="text-sm">Set as Primary Country</label>
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
                                        {c.exchange_rate_to_usd > 0 ? (1/c.exchange_rate_to_usd).toFixed(2) : '-'} {c.currency_code}
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

function AuthPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [error, setError] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#09090b] text-white p-4">
      <Card className="w-full max-w-md border-zinc-800 bg-zinc-900/50 backdrop-blur-xl">
        <h2 className="text-2xl font-light mb-6 text-center">COD Profit</h2>
        {error && <div className="p-3 mb-4 text-sm bg-red-500/10 text-red-500 rounded border border-red-500/20">{error}</div>}
        <form onSubmit={handleAuth} className="space-y-4">
          <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="name@example.com" />
          <Input label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Processing...' : (mode === 'signin' ? 'Sign In' : 'Sign Up')}
          </Button>
        </form>
        <div className="mt-4 text-center text-sm text-zinc-500">
          {mode === 'signin' ? "Don't have an account? " : "Already have an account? "}
          <button onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')} className="text-accent hover:underline">
            {mode === 'signin' ? 'Sign Up' : 'Sign In'}
          </button>
        </div>
      </Card>
    </div>
  );
}

function StockPage() {
  const { products, addProduct, updateProduct, deleteProduct, countries } = useGlobal();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<Partial<Product>>({});

  const handleSubmit = () => {
     const payload = { 
       ...form, 
       id: editingProduct ? editingProduct.id : generateId(),
       countries: form.countries || []
     } as Product;
     
     if (editingProduct) updateProduct(payload);
     else addProduct(payload);
     
     setIsModalOpen(false);
     setEditingProduct(null);
     setForm({});
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-light">Stock Management</h1>
        <Button onClick={() => { setEditingProduct(null); setForm({}); setIsModalOpen(true); }}><Plus size={16} className="mr-2" /> Add Product</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
         {products.map(p => (
             <Card key={p.id} className="relative group hover:border-accent/30 transition-all">
                 <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                     <button onClick={() => { setEditingProduct(p); setForm(p); setIsModalOpen(true); }} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded"><Edit3 size={14}/></button>
                     <button onClick={() => { if(window.confirm('Delete?')) deleteProduct(p.id); }} className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 rounded"><Trash2 size={14}/></button>
                 </div>
                 <div className="flex items-center gap-4">
                     <div className="w-12 h-12 bg-zinc-100 dark:bg-zinc-800 rounded-lg flex items-center justify-center shrink-0">
                         <Package size={20} className="text-zinc-400"/>
                     </div>
                     <div className="overflow-hidden">
                         <h3 className="font-medium truncate">{p.name}</h3>
                         <p className="text-xs text-zinc-500">Prod: {formatCurrency(p.price_production, 'USD')} | Ship: {formatCurrency(p.price_shipping, 'USD')}</p>
                     </div>
                 </div>
                 <div className="mt-4 flex gap-1 flex-wrap">
                     {p.countries.map(c => <Badge key={c}>{c}</Badge>)}
                 </div>
             </Card>
         ))}
      </div>

      {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <Card className="w-full max-w-lg">
                  <h3 className="text-xl font-light mb-4">{editingProduct ? 'Edit Product' : 'New Product'}</h3>
                  <div className="space-y-4">
                      <Input label="Name" value={form.name || ''} onChange={e => setForm({...form, name: e.target.value})} />
                      <div className="grid grid-cols-2 gap-4">
                          <Input label="Production Cost (USD)" type="number" value={form.price_production || 0} onChange={e => setForm({...form, price_production: parseFloat(e.target.value)})} />
                          <Input label="Shipping Cost (USD)" type="number" value={form.price_shipping || 0} onChange={e => setForm({...form, price_shipping: parseFloat(e.target.value)})} />
                      </div>
                      <div>
                          <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider ml-1 block mb-2">Countries</label>
                          <div className="flex gap-2 flex-wrap">
                              {countries.map(c => (
                                  <button key={c.code} onClick={() => {
                                      const cur = form.countries || [];
                                      setForm({...form, countries: cur.includes(c.code) ? cur.filter(x => x !== c.code) : [...cur, c.code]});
                                  }} className={`px-3 py-1 text-xs rounded-full border ${ (form.countries || []).includes(c.code) ? 'bg-zinc-900 text-white dark:bg-white dark:text-black' : 'border-zinc-200 dark:border-zinc-700' }`}>
                                      {c.name}
                                  </button>
                              ))}
                          </div>
                      </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-6">
                      <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                      <Button onClick={handleSubmit}>Save</Button>
                  </div>
              </Card>
          </div>
      )}
    </div>
  );
}

function SalesPage() {
    const { sales, products, addSales } = useGlobal();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
            const newSales = data.map((row: any) => ({
                id: generateId(),
                date: row.Date || formatDate(new Date()),
                full_name: row['Full Name'] || 'Unknown',
                phone: row.Phone || '',
                product_id: products.find(p => p.name === row.Product)?.id || '',
                quantity: Number(row.Quantity) || 1,
                total_price: Number(row['Total Price']) || 0,
                delivery_price: Number(row['Delivery Price']) || 0,
                status: OrderStatus.DELIVERED,
                country: row.Country || 'MA'
            })).filter((s: any) => s.product_id);
            addSales(newSales);
        };
        reader.readAsBinaryString(file);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-light">Sales</h1>
                <div className="flex gap-2">
                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".xlsx" />
                    <Button variant="secondary" onClick={() => fileInputRef.current?.click()}><Upload size={16} className="mr-2"/> Import Excel</Button>
                </div>
            </div>
            <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs uppercase bg-zinc-50 dark:bg-zinc-900/50 text-zinc-500">
                            <tr>
                                <th className="px-4 py-3">Date</th>
                                <th className="px-4 py-3">Customer</th>
                                <th className="px-4 py-3">Product</th>
                                <th className="px-4 py-3">Total</th>
                                <th className="px-4 py-3">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {sales.slice().reverse().slice(0, 50).map(s => (
                                <tr key={s.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                                    <td className="px-4 py-3 whitespace-nowrap">{s.date}</td>
                                    <td className="px-4 py-3">{s.full_name}<div className="text-xs text-zinc-500">{s.phone}</div></td>
                                    <td className="px-4 py-3">{products.find(p => p.id === s.product_id)?.name}</td>
                                    <td className="px-4 py-3 font-mono">{s.total_price}</td>
                                    <td className="px-4 py-3"><Badge>{s.status}</Badge></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    )
}

function AdsPage() {
    return <ExpensePage type="ADS" title="Ads Spend" />;
}

function FixedChargesPage() {
    return <ExpensePage type="FIXED" title="Fixed Charges" />;
}

function TestChargesPage() {
    return <ExpensePage type="TEST" title="Test Charges" />;
}

function ExpensePage({ type, title }: { type: 'ADS' | 'FIXED' | 'TEST', title: string }) {
    const { expenses, addExpenses, products, deleteExpense } = useGlobal();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
             const bstr = evt.target?.result;
             const wb = XLSX.read(bstr, { type: 'binary' });
             const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
             const newExpenses = data.map((row: any) => ({
                 id: generateId(),
                 date: row.Date,
                 amount: Number(row.Amount),
                 type,
                 platform: row.Platform,
                 name: row.Description || row.Name,
                 product_id: products.find(p => p.name === row.Product)?.id,
                 country: row.Country || 'MA',
                 note: row.Note
             })).filter((e: any) => type === 'FIXED' ? true : e.product_id); 
             addExpenses(newExpenses);
        };
        reader.readAsBinaryString(file);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-light">{title}</h1>
                <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => downloadTemplate(type === 'FIXED' ? 'CHARGES_FIXED' : (type === 'TEST' ? 'CHARGES_TEST' : 'ADS'))}><Download size={16} className="mr-2"/> Template</Button>
                    <input type="file" ref={fileInputRef} onChange={handleImport} className="hidden" accept=".xlsx" />
                    <Button variant="secondary" onClick={() => fileInputRef.current?.click()}><Upload size={16} className="mr-2"/> Import</Button>
                </div>
            </div>
            <Card className="overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs uppercase bg-zinc-50 dark:bg-zinc-900/50 text-zinc-500">
                        <tr>
                            <th className="px-4 py-3">Date</th>
                            <th className="px-4 py-3">Description/Platform</th>
                            {type !== 'FIXED' && <th className="px-4 py-3">Product</th>}
                            <th className="px-4 py-3">Amount</th>
                            <th className="px-4 py-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {expenses.filter(e => e.type === type).map(e => (
                            <tr key={e.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                                <td className="px-4 py-3 whitespace-nowrap">{e.date}</td>
                                <td className="px-4 py-3">{e.platform || e.name || '-'}</td>
                                {type !== 'FIXED' && <td className="px-4 py-3">{products.find(p => p.id === e.product_id)?.name || '-'}</td>}
                                <td className="px-4 py-3 font-mono">{e.amount}</td>
                                <td className="px-4 py-3">
                                    <button onClick={() => deleteExpense(e.id)} className="text-red-500 hover:text-red-700"><Trash2 size={14}/></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                 {expenses.filter(e => e.type === type).length === 0 && <div className="p-8 text-center text-zinc-500">No records found.</div>}
            </Card>
        </div>
    )
}

function ProfilePage() {
    const { user } = useGlobal();
    const navigate = useNavigate();
    
    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/');
    };

    return (
        <div className="max-w-md mx-auto mt-20 space-y-6">
            <h1 className="text-2xl font-light text-center">User Profile</h1>
            <Card className="flex flex-col items-center p-8 gap-4">
                <div className="w-20 h-20 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center text-3xl">
                    <UserCircle size={40} className="text-zinc-400" />
                </div>
                <div className="text-center">
                    <div className="font-medium text-lg">{user?.email}</div>
                    <div className="text-sm text-zinc-500">User ID: {user?.id}</div>
                </div>
                <Button variant="secondary" className="w-full mt-4" onClick={handleLogout}>
                    <LogOut size={16} className="mr-2" /> Sign Out
                </Button>
            </Card>
        </div>
    )
}
