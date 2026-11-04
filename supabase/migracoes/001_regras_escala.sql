-- =====================================================================
-- Regras da escala do Spot · cole no SQL Editor do Supabase e clique em Run.
-- Pode rodar mais de uma vez sem problema. Não apaga nenhum dado.
-- =====================================================================

-- 1) Novos campos do funcionário: setores (mais de um), turno fixo e 2 folgas fixas.
--    folgas: números dos dias, 1 = segunda ... 6 = sábado (ex.: {2,3} = terça e quarta).
alter table funcionarios add column if not exists funcoes text[] not null default '{}';
alter table funcionarios add column if not exists turno_fixo_id uuid references turnos (id);
alter table funcionarios add column if not exists folgas smallint[] not null default '{}';

-- 2) Domingo de folga do mês: cada funcionário folga em 1 domingo por mês.
create table if not exists folgas_domingo (
  id uuid primary key default gen_random_uuid(),
  funcionario_id uuid not null references funcionarios (id) on delete cascade,
  data date not null,
  criado_em timestamptz not null default now(),
  unique (funcionario_id, data)
);
create index if not exists folgas_domingo_data_idx on folgas_domingo (data);

alter table folgas_domingo enable row level security;
drop policy if exists "acesso aberto" on folgas_domingo;
create policy "acesso aberto" on folgas_domingo for all using (true) with check (true);

-- 3) Novos horários dos turnos (os mesmos turnos, só trocam os horários).
update turnos set hora_inicio = '07:45', hora_fim = '16:45' where nome = 'Almoço';
update turnos set hora_inicio = '16:45', hora_fim = '01:15' where nome = 'Jantar';
