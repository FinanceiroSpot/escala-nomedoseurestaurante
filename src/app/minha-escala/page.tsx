"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase, variaveisConfiguradas } from "@/lib/supabase";
import type { Escala, Funcionario, Turno } from "@/lib/tipos";
import { DIAS_SEMANA, diaMes, diasDaSemana, hojeISO, horaCurta, inicioDaSemana, paraData, somarDias } from "@/lib/datas";

// Tela só de consulta, para a equipe abrir pelo link do grupo.
export default function MinhaEscala() {
  const [segunda, setSegunda] = useState(() => inicioDaSemana(hojeISO()));
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [escalas, setEscalas] = useState<Escala[]>([]);
  const [eu, setEu] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const dias = diasDaSemana(segunda);

  const carregar = useCallback(async () => {
    if (!variaveisConfiguradas()) {
      setErro("As variáveis do Supabase não foram configuradas.");
      setCarregando(false);
      return;
    }
    const db = supabase();
    const [t, f, e] = await Promise.all([
      db.from("turnos").select("*").order("ordem"),
      db.from("funcionarios").select("id, nome, funcao, funcoes, ativo, turno_fixo_id, folgas").eq("ativo", true).order("nome"),
      db.from("escalas").select("id, data, turno_id, funcionario_id").gte("data", segunda).lte("data", somarDias(segunda, 6)),
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

  const nome = (id: string) => funcionarios.find((f) => f.id === id)?.nome ?? "";
  const turnoDoDia = (data: string, turnoId: string) =>
    escalas
      .filter((x) => x.data === data && x.turno_id === turnoId)
      .map((x) => ({ id: x.funcionario_id, nome: nome(x.funcionario_id) }))
      .filter((x) => x.nome)
      .sort((a, b) => a.nome.localeCompare(b.nome));
  const trabalhaNoDia = (data: string) => escalas.some((x) => x.data === data && x.funcionario_id === eu);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Minha escala</h1>
      <label className="block">
        <span className="text-sm font-medium">Quem é você?</span>
        <select className="campo mt-1" value={eu} onChange={(e) => setEu(e.target.value)}>
          <option value="">Mostrar todos</option>
          {funcionarios.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nome}
            </option>
          ))}
        </select>
      </label>

      <div className="flex items-center gap-2">
        <button className="botao-secundario" onClick={() => setSegunda(somarDias(segunda, -7))}>
          ‹ Anterior
        </button>
        <button className="botao-secundario" onClick={() => setSegunda(inicioDaSemana(hojeISO()))}>
          Hoje
        </button>
        <button className="botao-secundario" onClick={() => setSegunda(somarDias(segunda, 7))}>
          Próxima ›
        </button>
      </div>
      <p className="font-semibold">
        Semana de {diaMes(dias[0])} a {diaMes(dias[6])}
      </p>

      {erro && <p className="cartao text-red-700">Erro: {erro}</p>}
      {carregando && <p className="text-neutral-600">Carregando...</p>}

      {!carregando &&
        dias.map((d) => {
          const folga = eu && !trabalhaNoDia(d);
          return (
            <section key={d} className={`cartao ${folga ? "bg-green-50" : ""} ${d === hojeISO() ? "ring-2 ring-amber-400" : ""}`}>
              <h2 className="flex items-center justify-between text-lg font-bold">
                <span>
                  {DIAS_SEMANA[paraData(d).getDay()]} {diaMes(d)}
                </span>
                {folga && <span className="rounded-full bg-green-200 px-3 py-1 text-sm text-green-900">Folga</span>}
              </h2>
              {turnos.map((t) => {
                const gente = turnoDoDia(d, t.id);
                if (eu && !gente.some((g) => g.id === eu)) return null;
                return (
                  <div key={t.id} className="mt-2">
                    <p className="text-sm font-semibold text-neutral-600">
                      {t.nome} · {horaCurta(t.hora_inicio)}–{horaCurta(t.hora_fim)}
                    </p>
                    <p className="mt-1 leading-relaxed">
                      {gente.length === 0
                        ? "Ninguém escalado"
                        : gente.map((g, i) => (
                            <span key={g.id} className={g.id === eu ? "rounded bg-amber-200 px-1 font-bold" : ""}>
                              {g.nome}
                              {i < gente.length - 1 ? ", " : ""}
                            </span>
                          ))}
                    </p>
                  </div>
                );
              })}
            </section>
          );
        })}
    </div>
  );
}
