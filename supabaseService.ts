import { createClient } from '@supabase/supabase-js';

const PROJECT_URL = 'https://bcaywvntybbllfrzaozb.supabase.co';
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjYXl3dm50eWJibGxmcnphb3piIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MzE1MDYsImV4cCI6MjA4MTQwNzUwNn0.dVG7G31fXSrHgidQSY4arZJwSoAeT_R2fnL2csNoySI';

export const supabase = createClient(PROJECT_URL, API_KEY);

/**
 * SQL SCHEMA FOR THE USER TO RUN IN SUPABASE SQL EDITOR:
 * 
 * create table products (
 *   id uuid default uuid_generate_v4() primary key,
 *   name text not null,
 *   price_production numeric default 0,
 *   price_shipping numeric default 0,
 *   country text,
 *   note text,
 *   user_id uuid references auth.users(id)
 * );
 * 
 * create table sales (
 *   id uuid default uuid_generate_v4() primary key,
 *   date date not null,
 *   full_name text,
 *   phone text,
 *   product_id uuid references products(id),
 *   quantity integer default 1,
 *   total_price numeric default 0,
 *   delivery_price numeric default 0,
 *   status text check (status in ('PROCESSED', 'DELIVERED', 'PAID', 'RETURNED')),
 *   country text,
 *   user_id uuid references auth.users(id)
 * );
 * 
 * create table expenses (
 *   id uuid default uuid_generate_v4() primary key,
 *   date date not null,
 *   amount numeric default 0,
 *   type text check (type in ('ADS', 'FIXED', 'TEST')),
 *   platform text,
 *   name text,
 *   product_id uuid references products(id),
 *   country text,
 *   note text,
 *   user_id uuid references auth.users(id)
 * );
 * 
 * create table settings (
 *   id uuid default uuid_generate_v4() primary key,
 *   country_code text,
 *   exchange_rate_to_usd numeric default 1,
 *   service_fee numeric default 0,
 *   user_id uuid references auth.users(id)
 * );
 */