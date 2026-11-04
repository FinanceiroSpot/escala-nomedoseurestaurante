"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase, variaveisConfiguradas } from "@/lib/supabase";
import type { Escala, Funcionario, Turno } from "@/lib/tipos";
import { MINIMO_POR_DIA, SETORES } from "@/config/escala";
import { atribuirDomingos, domingosDoMes, gerarSemana } from "@/lib/gerarEscala";
import {
  diaMes,
  diasDaSemana,
  DIAS_SEMANA_CURTO,
  hojeISO,
  horaCurta,
  inicioDaSemana,
  paraData,
  somarDias,
} from "@/lib/datas";

type Celula = { data: string; turno: Turno };

export default function EscalaDaSemana() {
  const [segunda, setSegunda] = useState(() => inicioDaSemana(hojeISO()));
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [escalas, setEscalas] = useState<Escala[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [celula, setCelula] = useState<Celula | null>(null);
  const [gravando, setGravando] = useState(false);

  const dias = diasDaSemana(segunda);

  const carregar = useCallback(async () => {
    if (!variaveisConfiguradas()) {
      setErro("As variáveis do Supabase não foram configuradas.");
      setCarregando(false);
      return;
    }
    const db = supabase();
    const fim = somarDias(segunda, 6);
    const [t, f, e] = await Promise.all([
      db.from("turnos").select("*").order("ordem"),
      db
        .from("funcionarios")
        .select("id, nome, funcao, funcoes, telefone, cpf, ativo, turno_fixo_id, folgas")
        .order("nome"),
      db.from("escalas").select("id, data, turno_id, funcionario_id").gte("data", segunda).lte("data", fim),
    ]);
    const falha = t.error || f.error || e.error;
    if (falha) setErro(falha.message);
    else {
      setErro(null);
      setTurnos(t.data as Turno[]);
      setFuncionarios(f.data as Funcionario[]);
      setEscalas(e.data as Escala[]);
    }
    setCarregando(false);
  }, [segunda]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar();
  }, [carregar]);

  const daCelula = (data: string, turnoId: string) =>
    escalas.filter((x) => x.data === data && x.turno_id === turnoId);
  const totalDoDia = (data: string) => escalas.filter((x) => x.data === data).length;
  const minimoDoDia = (data: string) => MINIMO_POR_DIA[paraData(data).getDay()];

  async function alternar(f: Funcionario) {
    if (!celula) return;
    setGravando(true);
    const db = supabase();
    const existente = daCelula(celula.data, celula.turno.id).find((x) => x.funcionario_id === f.id);
    const { error } = existente
      ? await db.from("escalas").delete().eq("id", existente.id)
      : await db
          .from("escalas")
          .insert({ data: celula.data, turno_id: celula.turno.id, funcionario_id: f.id });
    setGravando(false);
    if (error) setErro(error.message);
    else await carregar();
  }

  async function gerar() {
    const prontos = funcionarios.filter((f) => f.ativo && f.turno_fixo_id && f.folgas?.length === 2);
    const sem = funcionarios.filter((f) => f.ativo).length - prontos.length;
    if (prontos.length === 0) {
      setErro("Nenhum funcionário tem turno fixo e 2 folgas definidos. Complete na tela Equipe.");
      return;
    }
    const ok = window.confirm(
      "Gerar a escala desta semana? Tudo o que já está marcada nesta semana será substituído.",
    );
    if (!ok) return;
    setGravando(true);
    setErro(null);
    setAviso(null);
    try {
      const db = supabase();
      const domingo = dias[6];
      const doMes = domingosDoMes(domingo);
      const { data: existentes, error: e1 } = await db
        .from("folgas_domingo")
        .select("funcionario_id, data")
        .gte("data", doMes[0])
        .lte("data", doMes[doMes.length - 1]);
      if (e1) throw e1;
      const novos = atribuirDomingos(prontos, doMes, existentes ?? []);
      if (novos.length) {
        const { error } = await db.from("folgas_domingo").insert(novos);
        if (error) throw error;
      }
      const folgaNoDomingo = new Set(
        [...(existentes ?? []), ...novos].filter((x) => x.data === domingo).map((x) => x.funcionario_id),
      );
      const linhas = gerarSemana(prontos, segunda, folgaNoDomingo);
      const { error: e2 } = await db.from("escalas").delete().gte("data", segunda).lte("data", dias[6]);
      if (e2) throw e2;
      for (let i = 0; i < linhas.length; i += 500) {
        const { error } = await db.from("escalas").insert(linhas.slice(i, i + 500));
        if (error) throw error;
      }
      setAviso(
        `Escala gerada: ${linhas.length} marcações.` +
          (sem > 0 ? ` ${sem} funcionário(s) ativo(s) ficaram de fora por falta de turno ou folgas.` : ""),
      );
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : (e as { message?: string }).message ?? String(e));
    }
    setGravando(false);
  }

  // Quem aparece na lista: o turno fixo da célula, quem não tem turno e quem já está marcado.
  const opcoes = celula
    ? funcionarios.filter(
        (f) =>
          (f.ativo && (!f.turno_fixo_id || f.turno_fixo_id === celula.turno.id)) ||
          daCelula(celula.data, celula.turno.id).some((x) => x.funcionario_id === f.id),
      )
    : [];
  const marcados = celula
    ? new Set(daCelula(celula.data, celula.turno.id).map((x) => x.funcionario_id))
    : new Set<string>();
  const setoresDe = (f: Funcionario) => (f.funcoes?.length ? f.funcoes : [f.funcao]);

  const intervalo = `${diaMes(dias[0])} a ${diaMes(dias[6])}/${paraData(dias[6]).getFullYear()}`;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Escala da semana</h1>

      <div className="flex items-center gap-2">
        <button className="botao-secundario" aria-label="Semana anterior" onClick={() => setSegunda(somarDias(segunda, -7))}>
          ‹ Anterior
        </button>
        <button className="botao-secundario" onClick={() => setSegunda(inicioDaSemana(hojeISO()))}>
          Hoje
        </button>
        <button className="botao-secundario" aria-label="Próxima semana" onClick={() => setSegunda(somarDias(segunda, 7))}>
          Próxima ›
        </button>
      </div>
      <p className="font-semibold">Semana de {intervalo}</p>

      <button className="botao w-full" onClick={gerar} disabled={gravando || carregando}>
        {gravando ? "Aguarde..." : "Gerar escala desta semana"}
      </button>

      {erro && <p className="cartao text-red-700">Erro: {erro}</p>}
      {aviso && <p className="cartao text-green-700">{aviso}</p>}
      {carregando && <p className="text-neutral-600">Carregando...</p>}

      {!carregando && turnos.length > 0 && (
        <div className="-mx-4 overflow-x-auto px-4">
          <table className="border-separate border-spacing-1.5">
            <thead>
              <tr>
                <th className="sticky left-0 z-[1] bg-[var(--cor-secundaria)]" />
                {dias.map((d) => {
                  const total = totalDoDia(d);
                  const minimo = minimoDoDia(d);
                  const falta = total < minimo;
                  return (
                    <th key={d} className={`min-w-20 rounded-lg px-1 py-2 text-sm ${d === hojeISO() ? "bg-amber-200" : ""}`}>
                      {DIAS_SEMANA_CURTO[paraData(d).getDay()]}
                      <br />
                      <span className="font-normal">{diaMes(d)}</span>
                      <br />
                      <span className={`text-xs ${falta ? "font-bold text-red-700" : "font-normal text-green-700"}`}>
                        {total}/{minimo}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {turnos.map((t) => (
                <tr key={t.id}>
                  <th className="sticky left-0 z-[1] bg-[var(--cor-secundaria)] pr-2 text-left text-sm">
                    {t.nome}
                    <br />
                    <span className="font-normal text-neutral-600">
                      {horaCurta(t.hora_inicio)}–{horaCurta(t.hora_fim)}
                    </span>
                  </th>
                  {dias.map((d) => {
                    const gente = daCelula(d, t.id);
                    return (
                      <td key={d}>
                        <button
                          onClick={() => setCelula({ data: d, turno: t })}
                          className={`h-16 w-full rounded-xl border text-base font-semibold active:scale-95 ${
                            gente.length ? "border-transparent text-white" : "border-neutral-300 bg-white text-neutral-500"
                          }`}
                          style={gente.length ? { background: "var(--cor-principal)" } : undefined}
                          aria-label={`${t.nome} ${diaMes(d)}: ${gente.length} pessoas`}
                        >
                          {gente.length ? gente.length : "+"}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-sm text-neutral-600">
        Toque em um quadrado para ajustar quem trabalha. Os números no topo mostram quantos trabalham no dia e o mínimo
        (vermelho = abaixo do mínimo).
      </p>

      {celula && (
        <div className="fixed inset-0 z-20 flex items-end bg-black/50 sm:items-center sm:justify-center" onClick={() => setCelula(null)}>
          <div
            className="max-h-[85vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 sm:max-w-md sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold">
              {celula.turno.nome} · {DIAS_SEMANA_CURTO[paraData(celula.data).getDay()]} {diaMes(celula.data)}
            </h2>
            <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
              {SETORES.map((s) => {
                const qtd = opcoes.filter((f) => marcados.has(f.id) && setoresDe(f).includes(s.nome)).length;
                return (
                  <span
                    key={s.nome}
                    className={`rounded-full px-2 py-1 ${qtd < s.minimo ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}`}
                  >
                    {s.nome} {qtd}/{s.minimo}
                  </span>
                );
              })}
            </div>
            <ul className="mt-3 space-y-2">
              {opcoes.map((f) => (
                <li key={f.id}>
                  <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-neutral-300 px-3">
                    <input
                      type="checkbox"
                      className="h-7 w-7"
                      checked={marcados.has(f.id)}
                      disabled={gravando}
                      onChange={() => alternar(f)}
                    />
                    <span className="text-base">
                      <span className="font-semibold">{f.nome}</span>
                      <span className="text-neutral-600">
                        {" "}
                        · {setoresDe(f).join(", ")}
                        {f.ativo ? "" : " (desativado)"}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
              {opcoes.length === 0 && <li className="text-neutral-600">Nenhum funcionário para este turno.</li>}
            </ul>
            <p className="mt-2 text-xs text-neutral-600">
              Quem trabalha em mais de um setor conta em todos os seus setores.
            </p>
            <button className="botao mt-4 w-full" onClick={() => setCelula(null)}>
              Pronto
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
