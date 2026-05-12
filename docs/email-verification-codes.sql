create table if not exists public.email_verification_codes (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  purpose text not null check (purpose in ('signup', 'email_change')),
  code_hash text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  next_allowed_at timestamptz not null,
  consumed_at timestamptz
);

create index if not exists email_verification_codes_lookup_idx
  on public.email_verification_codes (email, purpose, consumed_at, created_at desc);

alter table public.email_verification_codes enable row level security;

drop policy if exists "service role manages verification codes" on public.email_verification_codes;

create policy "service role manages verification codes"
  on public.email_verification_codes
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
