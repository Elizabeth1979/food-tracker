-- Database for the food tracker. Run once in a new Supabase project (SQL Editor), or as a migration.
-- camelCase columns are quoted on purpose: they match the app's field names 1:1, so no mapping layer is needed.
create type meal as enum ('breakfast', 'lunch', 'dinner', 'snack');

-- Own foods, plus edited/hidden copies of Ministry of Health foods (same id as in moh.json).
create table foods (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null default gen_random_uuid()::text,
  name text not null,
  "nameEn" text,
  source text,
  hidden boolean,
  "servingG" real not null,
  units jsonb,
  kcal real not null, carbs real not null, fat real not null, protein real not null,
  sodium real, calcium real, potassium real, b12 real,
  primary key (user_id, id)
);

-- One logged item; nutrients are totals for the logged amount (snapshot).
create table entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  date date not null,
  meal meal not null,
  "foodId" text,
  name text not null,
  grams real not null,
  qty real,
  unit text,
  kcal real not null, carbs real not null, fat real not null, protein real not null,
  sodium real, calcium real, potassium real, b12 real,
  created_at timestamptz not null default now() -- keeps items in the order they were logged
);
create index entries_user_date on entries (user_id, date);

create table saved_meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  items jsonb not null
);
create index saved_meals_user on saved_meals (user_id);

-- Daily goals; one row per user, id = user id.
create table profiles (
  id uuid primary key default auth.uid() references auth.users on delete cascade,
  kcal real, carbs real, fat real, protein real,
  recent text[] -- recently logged food ids, newest first (search favours them on every device)
);

alter table foods enable row level security;
alter table entries enable row level security;
alter table saved_meals enable row level security;
alter table profiles enable row level security;

create policy own on foods for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy own on entries for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy own on saved_meals for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy own on profiles for all to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
