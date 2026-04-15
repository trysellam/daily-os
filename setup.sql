-- Run this in your Supabase SQL editor (Dashboard > SQL Editor > New query)

create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  name text,
  vision text,
  bhags jsonb default '[]',
  onboarding_complete boolean default false,
  created_at timestamptz default now()
);

create table if not exists user_activities (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade unique,
  activities jsonb default '[]',
  created_at timestamptz default now()
);

create table if not exists daily_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade,
  log_date date not null,
  checked_activities jsonb default '[]',
  created_at timestamptz default now(),
  unique(user_id, log_date)
);

alter table profiles enable row level security;
alter table user_activities enable row level security;
alter table daily_logs enable row level security;

create policy "Users can manage own profile"
  on profiles for all using (auth.uid() = id);

create policy "Users can manage own activities"
  on user_activities for all using (auth.uid() = user_id);

create policy "Users can manage own logs"
  on daily_logs for all using (auth.uid() = user_id);
