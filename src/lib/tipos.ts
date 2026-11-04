// Tipos que espelham as tabelas do Supabase (veja supabase/schema.sql).

export type Funcionario = {
  id: string;
  nome: string;
  funcao: string;
  funcoes: string[]; // setores em que trabalha (pode ser mais de um)
  telefone: string | null;
  cpf: string | null;
  ativo: boolean;
  turno_fixo_id: string | null;
  folgas: number[]; // 2 dias seguidos, 1 = segunda ... 6 = sábado
};

export type FolgaDomingo = {
  id: string;
  funcionario_id: string;
  data: string; // domingo de folga
};

export type Turno = {
  id: string;
  nome: string;
  hora_inicio: string; // "11:00:00"
  hora_fim: string; // "15:30:00"
  ordem: number;
};

export type Escala = {
  id: string;
  data: string; // "2026-11-20"
  turno_id: string;
  funcionario_id: string;
};

export type Regra = {
  id: string;
  dia_semana: number | null; // 0 = domingo ... 6 = sábado; null = todos os dias
  turno_id: string;
  funcao: string;
  minimo: number;
};

export type Configuracao = {
  chave: string;
  valor: string;
};

export const FUNCOES_PADRAO = [
  "Salão",
  "Cozinha",
  "Caixa",
  "Bar",
  "Entregador",
  "Gerência",
];
