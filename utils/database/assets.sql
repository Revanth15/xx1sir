create table if not exists public.asset_type_configs (
  code text primary key,
  label text not null,
  inspection_frequency_days integer not null check (inspection_frequency_days > 0),
  checklist_schema_json jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  asset_code text not null unique,
  unit_code text not null,
  block_code text not null,
  level_code text not null,
  unit_number text,
  asset_type_code text not null references public.asset_type_configs(code),
  serial_number text not null,
  display_name text,
  location_note text,
  is_active boolean not null default true,
  last_inspected_at timestamp with time zone,
  last_inspected_by text,
  last_serviceability_status text check (
    last_serviceability_status in ('SERVICEABLE', 'UNSERVICEABLE')
  ),
  last_check_summary_json jsonb,
  latest_inspection_id uuid,
  created_at timestamp with time zone not null default now(),
  created_by text not null,
  updated_at timestamp with time zone not null default now(),
  updated_by text not null
);

create table if not exists public.asset_inspections (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  inspected_at timestamp with time zone not null,
  inspected_by_user_id uuid,
  inspected_by_name text not null,
  serviceability_status text not null check (
    serviceability_status in ('SERVICEABLE', 'UNSERVICEABLE')
  ),
  core_notes text,
  check_results_json jsonb not null default '{}'::jsonb,
  linked_report_id uuid,
  created_at timestamp with time zone not null default now()
);

alter table public.assets
  add column if not exists latest_inspection_id uuid;

alter table public.assets
  add column if not exists unit_number text;

alter table public.asset_inspections
  add column if not exists linked_report_id uuid;

alter table public.barrack_damage
  add column if not exists asset_id uuid references public.assets(id) on delete set null,
  add column if not exists source_inspection_id uuid references public.asset_inspections(id) on delete set null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'assets_latest_inspection_id_fkey'
  ) then
    alter table public.assets
      add constraint assets_latest_inspection_id_fkey
      foreign key (latest_inspection_id)
      references public.asset_inspections(id)
      on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'asset_inspections_linked_report_id_fkey'
  ) then
    alter table public.asset_inspections
      add constraint asset_inspections_linked_report_id_fkey
      foreign key (linked_report_id)
      references public.barrack_damage(id)
      on delete set null;
  end if;
end $$;

create index if not exists idx_assets_asset_code on public.assets(asset_code);
create index if not exists idx_assets_asset_type_code on public.assets(asset_type_code);
create index if not exists idx_assets_location on public.assets(unit_code, block_code, level_code);
create index if not exists idx_assets_room_lookup on public.assets(block_code, level_code, unit_number);
create index if not exists idx_assets_is_active on public.assets(is_active);
create index if not exists idx_asset_inspections_asset_id on public.asset_inspections(asset_id);
create index if not exists idx_asset_inspections_inspected_at on public.asset_inspections(inspected_at desc);
create index if not exists idx_barrack_damage_asset_id on public.barrack_damage(asset_id);
create index if not exists idx_barrack_damage_source_inspection_id on public.barrack_damage(source_inspection_id);

insert into public.asset_type_configs (
  code,
  label,
  inspection_frequency_days,
  checklist_schema_json,
  is_active
)
values
  (
    'WATERCOOLER',
    'Water Cooler',
    7,
    '{"is_cold":{"type":"boolean","required":true,"label":"Dispenses cold water"}}'::jsonb,
    true
  ),
  (
    'FIREEXT',
    'Fire Extinguisher',
    180,
    '{"valid_until":{"type":"date","required":true,"label":"Valid Until"}}'::jsonb,
    true
  ),
  (
    'SHOWER',
    'Shower',
    30,
    '{"water_flow_ok":{"type":"boolean","required":true,"label":"Water flow is normal"},"drainage_ok":{"type":"boolean","required":true,"label":"Drainage is clear"}}'::jsonb,
    true
  ),
  (
    'SINK',
    'Sink',
    30,
    '{"tap_ok":{"type":"boolean","required":true,"label":"Tap is working"},"drainage_ok":{"type":"boolean","required":true,"label":"Drainage is clear"}}'::jsonb,
    true
  ),
  (
    'TOILET',
    'Toilets',
    30,
    '{"flush_ok":{"type":"boolean","required":true,"label":"Flush is working"},"leak_free":{"type":"boolean","required":true,"label":"No leak observed"}}'::jsonb,
    true
  ),
  (
    'EXITLIGHT',
    'Exit Light',
    30,
    '{"light_on":{"type":"boolean","required":true,"label":"Light is on"},"sign_visible":{"type":"boolean","required":true,"label":"Sign is visible"}}'::jsonb,
    true
  ),
  (
    'LIGHT',
    'Light',
    30,
    '{"condition_ok":{"type":"boolean","required":true,"label":"Condition is acceptable"}}'::jsonb,
    true
  ),
  (
    'FAN',
    'Fan',
    30,
    '{"condition_ok":{"type":"boolean","required":true,"label":"Condition is acceptable"}}'::jsonb,
    true
  ),
  (
    'AIRCON',
    'Aircon',
    30,
    '{"condition_ok":{"type":"boolean","required":true,"label":"Condition is acceptable"}}'::jsonb,
    true
  ),
  (
    'WINDOW',
    'Window',
    30,
    '{"condition_ok":{"type":"boolean","required":true,"label":"Condition is acceptable"}}'::jsonb,
    true
  ),
  (
    'DOOR',
    'Door',
    30,
    '{"condition_ok":{"type":"boolean","required":true,"label":"Condition is acceptable"}}'::jsonb,
    true
  ),
  (
    'FALSECEILING',
    'False Ceiling',
    30,
    '{"condition_ok":{"type":"boolean","required":true,"label":"Condition is acceptable"}}'::jsonb,
    true
  ),
  (
    'CORRIDOR',
    'Corridor',
    30,
    '{"condition_ok":{"type":"boolean","required":true,"label":"Condition is acceptable"}}'::jsonb,
    true
  ),
  (
    'BOOTWASHER',
    'Bootwasher',
    30,
    '{"condition_ok":{"type":"boolean","required":true,"label":"Condition is acceptable"}}'::jsonb,
    true
  ),
  (
    'WASHINGMACHINE',
    'Washing Machine',
    30,
    '{"condition_ok":{"type":"boolean","required":true,"label":"Condition is acceptable"}}'::jsonb,
    true
  )
on conflict (code) do nothing;
