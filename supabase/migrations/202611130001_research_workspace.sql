-- QuantLab research persistence schema
-- Stores datasets, visualization preferences and learning annotations only.
-- There are deliberately no orders, positions, account balances or execution records.

create table if not exists public.research_datasets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  description text not null default '',
  source_kind text not null default 'synthetic'
    check (source_kind in ('synthetic', 'user_upload')),
  row_count integer not null default 0 check (row_count >= 0),
  schema_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.research_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  dataset_id uuid references public.research_datasets(id) on delete set null,
  title text not null default 'Untitled research session'
    check (char_length(title) between 1 and 160),
  current_observation integer not null default 0 check (current_observation >= 0),
  chart_config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.research_annotations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.research_sessions(id) on delete cascade,
  observation_index integer not null check (observation_index >= 0),
  body text not null check (char_length(body) between 1 and 10000),
  anchor jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chart_drawings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.research_sessions(id) on delete cascade,
  drawing_type text not null
    check (drawing_type in ('horizontal_line', 'trend_line', 'rectangle', 'fibonacci_retracement')),
  -- Anchors use observation indices and values, never screen-pixel coordinates.
  anchors jsonb not null default '[]'::jsonb,
  style jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists research_datasets_owner_updated_idx
  on public.research_datasets (owner_id, updated_at desc);
create index if not exists research_sessions_owner_updated_idx
  on public.research_sessions (owner_id, updated_at desc);
create index if not exists research_annotations_session_index_idx
  on public.research_annotations (session_id, observation_index);
create index if not exists chart_drawings_session_idx
  on public.chart_drawings (session_id);

alter table public.research_datasets enable row level security;
alter table public.research_sessions enable row level security;
alter table public.research_annotations enable row level security;
alter table public.chart_drawings enable row level security;

create policy "Owners manage their research datasets"
  on public.research_datasets for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Owners manage their research sessions"
  on public.research_sessions for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Owners manage their research annotations"
  on public.research_annotations for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Owners manage their chart drawings"
  on public.chart_drawings for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);
