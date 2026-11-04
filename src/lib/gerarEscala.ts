// Regras para montar a semana. Sem acesso ao banco: recebe dados e devolve linhas.
import { MINIMO_POR_DIA } from "@/config/escala";
import { diasDaSemana, paraData, paraISO } from "@/lib/datas";
import type { Funcionario } from "@/lib/tipos";

/** Dia da semana (0 = domingo) da posição 0..6 de uma semana que começa na segunda. */
const diaDaPosicao = (i: number) => (i + 1) % 7;

export type LinhaEscala = { data: string; turno_id: string; funcionario_id: string };

/** Todos os domingos (ISO) do mês da data informada. */
export function domingosDoMes(iso: string): string[] {
  const d = paraData(iso);
  const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const lista: string[] = [];
  for (let dia = 1; dia <= ultimo; dia++) {
    const x = new Date(d.getFullYear(), d.getMonth(), dia);
    if (x.getDay() === 0) lista.push(paraISO(x));
  }
  return lista;
}

/**
 * Sorteia (de forma equilibrada) o domingo de folga do mês de quem ainda não tem.
 * Devolve só os que faltam.
 */
export function atribuirDomingos(
  funcionarios: Funcionario[],
  domingos: string[],
  existentes: { funcionario_id: string; data: string }[],
): { funcionario_id: string; data: string }[] {
  const doMes = existentes.filter((e) => domingos.includes(e.data));
  const jaTem = new Set(doMes.map((e) => e.funcionario_id));
  const porTurno = new Map<string, number>(); // "turno|data" -> quantos folgam
  const porData = new Map<string, number>();
  const turnoDe = new Map(funcionarios.map((f) => [f.id, f.turno_fixo_id ?? ""]));
  for (const e of doMes) {
    const k = `${turnoDe.get(e.funcionario_id) ?? ""}|${e.data}`;
    porTurno.set(k, (porTurno.get(k) ?? 0) + 1);
    porData.set(e.data, (porData.get(e.data) ?? 0) + 1);
  }
  const novos: { funcionario_id: string; data: string }[] = [];
  const faltam = funcionarios
    .filter((f) => !jaTem.has(f.id))
    .sort((a, b) => (a.turno_fixo_id ?? "").localeCompare(b.turno_fixo_id ?? "") || a.nome.localeCompare(b.nome));
  for (const f of faltam) {
    const turno = f.turno_fixo_id ?? "";
    let melhor = domingos[0];
    for (const d of domingos) {
      const a = [porTurno.get(`${turno}|${d}`) ?? 0, porData.get(d) ?? 0];
      const b = [porTurno.get(`${turno}|${melhor}`) ?? 0, porData.get(melhor) ?? 0];
      if (a[0] < b[0] || (a[0] === b[0] && a[1] < b[1])) melhor = d;
    }
    novos.push({ funcionario_id: f.id, data: melhor });
    porTurno.set(`${turno}|${melhor}`, (porTurno.get(`${turno}|${melhor}`) ?? 0) + 1);
    porData.set(melhor, (porData.get(melhor) ?? 0) + 1);
  }
  return novos;
}

/**
 * Monta a semana (segunda a domingo).
 * - Segunda a sábado: trabalha, menos nas 2 folgas fixas.
 * - Domingo: trabalha, menos no domingo de folga do mês.
 * - Na semana do domingo de folga, só sobra 1 folga na semana: ela vai para o
 *   dia (segunda a sábado) com menos funcionários.
 */
export function gerarSemana(
  funcionarios: Funcionario[],
  segunda: string,
  folgaNoDomingo: Set<string>,
): LinhaEscala[] {
  const dias = diasDaSemana(segunda);
  const trabalha = new Map<string, boolean[]>();
  const contagem = new Array(7).fill(0) as number[];

  for (const f of funcionarios) {
    const dia = dias.map((_, i) =>
      i === 6 ? !folgaNoDomingo.has(f.id) : !f.folgas.includes(diaDaPosicao(i)),
    );
    trabalha.set(f.id, dia);
    dia.forEach((v, i) => {
      if (v) contagem[i]++;
    });
  }

  // Quem folga no domingo: devolve as folgas fixas e coloca 1 só no dia mais fraco.
  const comDomingo = funcionarios
    .filter((f) => folgaNoDomingo.has(f.id))
    .sort((a, b) => a.nome.localeCompare(b.nome));
  for (const f of comDomingo) {
    const dia = trabalha.get(f.id)!;
    for (let i = 0; i < 6; i++) {
      if (!dia[i]) {
        dia[i] = true;
        contagem[i]++;
      }
    }
    let fraco = 0;
    for (let i = 1; i < 6; i++) {
      const a = contagem[i] - MINIMO_POR_DIA[diaDaPosicao(i)];
      const b = contagem[fraco] - MINIMO_POR_DIA[diaDaPosicao(fraco)];
      if (contagem[i] < contagem[fraco] || (contagem[i] === contagem[fraco] && a < b)) fraco = i;
    }
    dia[fraco] = false;
    contagem[fraco]--;
  }

  const linhas: LinhaEscala[] = [];
  for (const f of funcionarios) {
    const dia = trabalha.get(f.id)!;
    dia.forEach((v, i) => {
      if (v && f.turno_fixo_id) linhas.push({ data: dias[i], turno_id: f.turno_fixo_id, funcionario_id: f.id });
    });
  }
  return linhas;
}
