"use client";

import { useCallback, useEffect, useState } from "react";
import { variaveisConfiguradas } from "@/lib/supabase";
import {
  criarFuncionario,
  editarFuncionario,
  listarFuncionarios,
  mudarAtivo,
} from "@/lib/dados";
import { FUNCOES_PADRAO, type Funcionario } from "@/lib/tipos";

type Form = { id: string | null; nome: string; funcao: string; telefone: string };
const FORM_VAZIO: Form = { id: null, nome: "", funcao: "", telefone: "" };

export default function Equipe() {
  const [lista, setLista] = useState<Funcionario[] | null>(null);
  const [erro, setErro] = useState("");
  const [form, setForm] = useState<Form | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      if (!variaveisConfiguradas()) throw new Error("O banco de dados não está configurado.");
      setLista(await listarFuncionarios());
      setErro("");
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const funcoes = Array.from(
    new Set([...FUNCOES_PADRAO, ...(lista ?? []).map((f) => f.funcao)]),
  ).sort((a, b) => a.localeCompare(b, "pt-BR"));

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    const dados = {
      nome: form.nome.trim(),
      funcao: form.funcao.trim(),
      telefone: form.telefone.trim() || null,
    };
    if (!dados.nome || !dados.funcao) {
      setErro("Preencha o nome e a função.");
      return;
    }
    setSalvando(true);
    try {
      if (form.id) await editarFuncionario(form.id, dados);
      else await criarFuncionario(dados);
      setForm(null);
      await carregar();
    } catch (e) {
      setErro("Não foi possível salvar. " + (e instanceof Error ? e.message : ""));
    } finally {
      setSalvando(false);
    }
  }

  async function alternar(f: Funcionario) {
    try {
      await mudarAtivo(f.id, !f.ativo);
      await carregar();
    } catch (e) {
      setErro("Não foi possível alterar. " + (e instanceof Error ? e.message : ""));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Equipe</h1>
        <button
          className="botao"
          onClick={() => {
            setErro("");
            setForm({ ...FORM_VAZIO });
          }}
        >
          + Adicionar
        </button>
      </div>

      {erro && <p className="rounded-xl bg-red-50 p-3 text-red-700">{erro}</p>}
      {!lista && !erro && <p className="text-neutral-600">Carregando...</p>}

      {form && (
        <form onSubmit={salvar} className="cartao space-y-3">
          <h2 className="text-lg font-semibold">
            {form.id ? "Editar funcionário" : "Novo funcionário"}
          </h2>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Nome</span>
            <input
              className="campo"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              autoComplete="off"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Função</span>
            <input
              className="campo"
              list="funcoes"
              value={form.funcao}
              onChange={(e) => setForm({ ...form, funcao: e.target.value })}
              placeholder="Escolha ou digite"
            />
            <datalist id="funcoes">
              {funcoes.map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Telefone</span>
            <input
              className="campo"
              type="tel"
              inputMode="tel"
              value={form.telefone}
              onChange={(e) => setForm({ ...form, telefone: e.target.value })}
              placeholder="(11) 91234-0000"
            />
          </label>
          <div className="flex gap-2">
            <button className="botao flex-1" disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar"}
            </button>
            <button
              type="button"
              className="botao-secundario flex-1"
              onClick={() => setForm(null)}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      <ul className="space-y-3">
        {lista?.map((f) => (
          <li key={f.id} className={`cartao ${f.ativo ? "" : "opacity-60"}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-lg font-semibold">{f.nome}</p>
                <p className="text-neutral-700">{f.funcao}</p>
                {f.telefone && (
                  <a href={`tel:${f.telefone}`} className="text-neutral-700 underline">
                    {f.telefone}
                  </a>
                )}
              </div>
              {!f.ativo && (
                <span className="rounded-full bg-neutral-200 px-3 py-1 text-sm font-medium">
                  Inativo
                </span>
              )}
            </div>
            <div className="mt-3 flex gap-2">
              <button
                className="botao-secundario flex-1"
                onClick={() => {
                  setErro("");
                  setForm({
                    id: f.id,
                    nome: f.nome,
                    funcao: f.funcao,
                    telefone: f.telefone ?? "",
                  });
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                Editar
              </button>
              <button className="botao-secundario flex-1" onClick={() => alternar(f)}>
                {f.ativo ? "Desativar" : "Reativar"}
              </button>
            </div>
          </li>
        ))}
      </ul>
      {lista && lista.length === 0 && (
        <p className="text-neutral-600">Nenhum funcionário cadastrado ainda.</p>
      )}
    </div>
  );
}
