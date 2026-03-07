-- 1. Create a single profiles table for both username and role
create table public.profiles (
  user_id uuid references auth.users(id) on delete cascade not null primary key,
  username text not null unique,
  -- We can easily expand this later to include 's4' or 'coy_ic' if needed
  role text not null check (role in ('admin', 'user')) default 'user',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Enable RLS
alter table public.profiles enable row level security;

-- 3. Create the admin check helper function (now pointing to profiles)
create or replace function public.is_admin()
returns boolean as $$
declare
  status boolean;
begin
  select (role = 'admin') into status from public.profiles where user_id = auth.uid();
  return coalesce(status, false);
end;
$$ language plpgsql security definer;

-- 4. RLS Policies for the unified profiles table
create policy "Admins can view all profiles" on public.profiles for select using (public.is_admin());
create policy "Admins can insert profiles" on public.profiles for insert with check (public.is_admin());
create policy "Admins can update profiles" on public.profiles for update using (public.is_admin());
create policy "Admins can delete profiles" on public.profiles for delete using (public.is_admin());

-- Allow users to read their OWN profile (needed to know their own username/role)
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = user_id);