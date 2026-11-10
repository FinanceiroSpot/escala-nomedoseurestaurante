// Acesso ao Supabase para a tela de Empréstimos (usado no navegador).
import { supabase } from "@/lib/supabase";
import { paraData } from "@/lib/datas";
import type { Devedor, Emprestimo, TipoEmprestimo } from "@/lib/tipos";
import type { LinhaImagem } from "@/lib/imagemTabela";

const COLUNAS =
  "id, data, devedor, tipo, grupo, produto, quantidade, unidade, valor, pago_em, observacao";

export type DadosEmprestimo = {
  data: string;
  devedor: Devedor;
  tipo: TipoEmprestimo;
  grupo: string;
  produto: string;
  quantidade: number;
  unidade: string | null;
  valor: number | null;
};

export async function listarEmprestimos(): Promise<Emprestimo[]> {
  // O Supabase devolve no máximo 1000 linhas por vez; buscamos em páginas.
  const todos: Emprestimo[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await supabase()
      .from("emprestimos")
      .select(COLUNAS)
      .order("data", { ascending: true })
      .order("criado_em", { ascending: true })
      .range(de, de + 999);
    if (error) throw error;
    todos.push(...(data as Emprestimo[]));
    if (data.length < 1000) break;
  }
  return todos;
}

export async function criarEmprestimo(dados: DadosEmprestimo) {
  const { error } = await supabase().from("emprestimos").insert(dados);
  if (error) throw error;
}

export async function editarEmprestimo(id: string, dados: DadosEmprestimo) {
  const { error } = await supabase().from("emprestimos").update(dados).eq("id", id);
  if (error) throw error;
}

export async function excluirEmprestimo(id: string) {
  const { error } = await supabase().from("emprestimos").delete().eq("id", id);
  if (error) throw error;
}

/** Marca vários itens como pagos na mesma data. */
export async function pagarItens(ids: string[], dataPagamento: string) {
  const { error } = await supabase()
    .from("emprestimos")
    .update({ pago_em: dataPagamento })
    .in("id", ids);
  if (error) throw error;
}

/** Paga só uma parte da quantidade: o que foi pago vira uma linha nova e o resto continua em aberto. */
export async function pagarParte(item: Emprestimo, quantidadePaga: number, dataPagamento: string) {
  const { error: e1 } = await supabase().from("emprestimos").insert({
    data: item.data,
    devedor: item.devedor,
    tipo: item.tipo,
    grupo: item.grupo,
    produto: item.produto,
    quantidade: quantidadePaga,
    unidade: item.unidade,
    valor: item.valor,
    pago_em: dataPagamento,
    observacao: item.observacao,
  });
  if (e1) throw e1;
  const { error: e2 } = await supabase()
    .from("emprestimos")
    .update({ quantidade: Math.round((item.quantidade - quantidadePaga) * 10000) / 10000 })
    .eq("id", item.id);
  if (e2) throw e2;
}

export async function desfazerPagamento(id: string) {
  const { error } = await supabase().from("emprestimos").update({ pago_em: null }).eq("id", id);
  if (error) throw error;
}

// ---------- Cálculos e formatos ----------

export function totalDoItem(e: Pick<Emprestimo, "valor" | "quantidade">): number {
  return (e.valor ?? 0) * e.quantidade;
}

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export function formatarMoeda(v: number): string {
  return moeda.format(v);
}

/** 0,5 -> "0,5"; 3 -> "3" */
export function formatarQuantidade(q: number): string {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(q);
}

/** "2026-11-09" -> "09/11/2026" */
export function dataBR(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
export { MESES };

/** Como na planilha: data do empréstimo menos a data de atualização (negativo = dias de atraso). */
export function diasEmAtraso(dataEmprestimo: string, atualizadoEm: string): number {
  const ms = paraData(dataEmprestimo).getTime() - paraData(atualizadoEm).getTime();
  return Math.round(ms / 86_400_000);
}

/** "29/jun" como na planilha. */
export function dataCurta(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${MESES[Number(m) - 1].slice(0, 3).toLowerCase()}`;
}

/** Converte "12,50" ou "1.250,50" em número; vazio ou inválido vira null. */
export function lerNumero(texto: string): number | null {
  let t = texto.trim();
  if (!t) return null;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

// ---------- Tabela no estilo da planilha (tela e imagem) ----------

export function tituloDaTabela(devedor: Devedor, tipo: TipoEmprestimo): string {
  const base = devedor === "paulista" ? "Transferencia JK para Paulista" : "Transferencia PAULISTA para JK";
  return tipo === "utensilio" ? `${base} · Utensílios` : base;
}

/** Linhas em aberto, da data mais antiga para a mais nova, como na planilha. */
export function linhasDaTabela(itens: Emprestimo[], atualizadoEm: string): LinhaImagem[] {
  return [...itens]
    .sort((a, b) => a.data.localeCompare(b.data))
    .map((e) => ({
      data: dataCurta(e.data),
      grupo: e.grupo,
      produto: e.produto,
      quantidade: formatarQuantidade(e.quantidade),
      unidade: e.unidade ?? "",
      valor: e.valor,
      total: e.valor === null ? null : totalDoItem(e),
      dias: diasEmAtraso(e.data, atualizadoEm),
    }));
}
