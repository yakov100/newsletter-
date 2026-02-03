-- Archive: saved articles (title + content)
create table if not exists public.archive (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  content text not null,
  created_at timestamptz default now()
);

alter table public.archive enable row level security;

create policy "Users can manage own archive"
  on public.archive
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Optional: writing_sessions for persistence
create table if not exists public.writing_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  stage text not null,
  ideas jsonb default '[]',
  selected_idea jsonb,
  outline text default '',
  draft_content text default '',
  edited_content text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.writing_sessions enable row level security;

create policy "Users can manage own sessions"
  on public.writing_sessions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Optional: agent_configs in DB (app can use file-based config instead)
create table if not exists public.agent_configs (
  id uuid primary key default gen_random_uuid(),
  agent_type text not null unique check (agent_type in ('ideas', 'writing')),
  config jsonb not null default '{}',
  updated_at timestamptz default now()
);

alter table public.agent_configs enable row level security;

create policy "Allow read for authenticated"
  on public.agent_configs for select
  using (true);

create policy "Allow update for authenticated"
  on public.agent_configs for update
  using (auth.role() = 'authenticated');
