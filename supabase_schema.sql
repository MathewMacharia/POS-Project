-- 1. Enable UUID extension
create extension if not exists "uuid-ossp";

-- 2. Drop existing tables if they exist
drop table if exists stock_logs cascade;
drop table if exists suppliers cascade;
drop table if exists audit_logs cascade;
drop table if exists expenses cascade;
drop table if exists sales cascade;
drop table if exists products cascade;
drop table if exists categories cascade;
drop table if exists profiles cascade;

-- 3. Profiles / Cashiers & Admins Table
create table profiles (
  id uuid primary key default uuid_generate_v4(),
  username text unique not null,
  full_name text not null,
  email text,
  role text not null check (role in ('admin', 'cashier')),
  phone text,
  active boolean default true,
  pin text not null, -- Stores unlock PINs
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Categories Table
create table categories (
  id uuid primary key default uuid_generate_v4(),
  name text unique not null,
  is_custom boolean default false,
  date_added timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Products Table
create table products (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  category text not null references categories(name) on update cascade,
  barcode text,
  buying_price numeric not null default 0,
  selling_price numeric not null default 0,
  quantity_in_stock integer not null default 0,
  supplier_name text,
  description text,
  image_url text,
  expiry_date date,
  date_added timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. Sales Table
create table sales (
  id uuid primary key default uuid_generate_v4(),
  receipt_number text unique not null,
  items jsonb not null, -- Stores array of SaleItems
  subtotal numeric not null default 0,
  tax_amount numeric not null default 0,
  total numeric not null default 0,
  discount numeric default 0,
  payment_method text not null check (payment_method in ('Cash', 'M-Pesa', 'Bank')),
  payment_details_ref text,
  paid_amount numeric not null default 0,
  change_amount numeric not null default 0,
  cashier_id uuid references profiles(id),
  cashier_name text not null,
  date_added timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 7. Expenses Table
create table expenses (
  id uuid primary key default uuid_generate_v4(),
  category text not null,
  item_name text not null,
  amount numeric not null default 0,
  date date not null default current_date,
  notes text,
  recorded_by text not null,
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 8. Audit Logs Table
create table audit_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete set null,
  user_name text not null,
  action text not null,
  details text,
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 9. Suppliers Table
create table suppliers (
  id uuid primary key default uuid_generate_v4(),
  name text unique not null,
  phone text,
  email text,
  location text,
  products_supplied text[] default '{}'::text[]
);

-- 10. Stock Logs Table
create table stock_logs (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid references products(id) on delete cascade,
  product_name text not null,
  change_qty integer not null,
  type text not null check (type in ('restock', 'sale', 'discard_expired', 'adjustment', 'initial')),
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null,
  operator_name text not null,
  notes text
);

-- 11. Insert Default Admin and Cashier Profiles
insert into profiles (id, username, full_name, role, pin) values
  ('d3b07384-d113-4ec2-a5d2-f67332c9641d', 'admin', 'Erick Omondi', 'admin', '1234'),
  ('a8f9b90c-8438-4e89-8d7b-449e7b252062', 'cashier', 'Mercy Wanjiku', 'cashier', '5678');

-- 12. Insert Default Categories
insert into categories (name, is_custom) values
  ('Groceries', false),
  ('Beverages', false),
  ('Toiletries', false),
  ('Bakery', false),
  ('Snacks', false),
  ('Household', false);
