// Acesso ao Supabase para Equipe e Escala (usado pelas telas, no navegador).
import { supabase } from "@/lib/supabase";
import type { Escala, Funcionario, Turno } from "@/lib/tipos";

export type DadosFuncionario = {
  nome: string;
  funcao: string;
  telefone: string | null;
};

export async function listarFuncionarios(): Promise<Funcionario[]> {
  const { data, error } = await supabase()
    .from("funcionarios")
    .select("id, nome, funcao, telefone, cpf, ativo")
    .order("nome");
  if (error) throw error;
  return data as Funcionario[];
}

export async function criarFuncionario(dados: DadosFuncionario) {
  const { error } = await supabase().from("funcionarios").insert(dados);
  if (error) throw error;
}

export async function editarFuncionario(id: string, dados: DadosFuncionario) {
  const { error } = await supabase().from("funcionarios").update(dados).eq("id", id);
  if (error) throw error;
}

export async function mudarAtivo(id: string, ativo: boolean) {
  const { error } = await supabase().from("funcionarios").update({ ativo }).eq("id", id);
  if (error) throw error;
}

export async function listarTurnos(): Promise<Turno[]> {
  const { data, error } = await supabase()
    .from("turnos")
    .select("id, nome, hora_inicio, hora_fim, ordem")
    .order("ordem");
  if (error) throw error;
  return data as Turno[];
}

export async function listarEscala(inicio: string, fim: string): Promise<Escala[]> {
  const { data, error } = await supabase()
    .from("escalas")
    .select("id, data, turno_id, funcionario_id")
    .gte("data", inicio)
    .lte("data", fim);
  if (error) throw error;
  return data as Escala[];
}

/** Troca a equipe de um dia e turno pela lista recebida. */
export async function salvarCelula(data: string, turnoId: string, funcionarioIds: string[]) {
  const db = supabase();
  const { error: e1 } = await db.from("escalas").delete().eq("data", data).eq("turno_id", turnoId);
  if (e1) throw e1;
  if (funcionarioIds.length === 0) return;
  const { error: e2 } = await db.from("escalas").insert(
    funcionarioIds.map((funcionario_id) => ({ data, turno_id: turnoId, funcionario_id })),
  );
  if (e2) throw e2;
}
