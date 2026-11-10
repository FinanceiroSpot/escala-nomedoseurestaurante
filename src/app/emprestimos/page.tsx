"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { variaveisConfiguradas } from "@/lib/supabase";
import { hojeISO } from "@/lib/datas";
import {
  MESES,
  criarEmprestimo,
  dataBR,
  dataCurta,
  desfazerPagamento,
  diasEmAtraso,
  editarEmprestimo,
  excluirEmprestimo,
  formatarMoeda,
  formatarQuantidade,
  lerNumero,
  listarEmprestimos,
  pagarItens,
  pagarParte,
  totalDoItem,
  type DadosEmprestimo,
} from "@/lib/emprestimos";
import type { Devedor, Emprestimo, TipoEmprestimo } from "@/lib/tipos";
import { Calendario, CampoData } from "@/components/Calendario";
import { Folha } from "@/components/Folha";

type Aba = TipoEmprestimo | "pagos";

const NOME_DEVEDOR: Record<Devedor, string> = { paulista: "Paulista deve", jk: "JK deve" };
const DE_PARA: Record<Devedor, string> = {
  paulista: "JK emprestou para o Paulista",
  jk: "Paulista emprestou para o JK",
};
const UNIDADES = ["UND", "KG", "PCT", "CX", "FD", "BLD", "BDJ", "GRM", "LT"];

type Form = {
  id: string | null;
  devedor: Devedor;
  tipo: TipoEmprestimo;
  data: string;
  grupo: string;
  produto: string;
  quantidade: string;
  unidade: string;
  valor: string;
};

function formVazio(devedor: Devedor, tipo: TipoEmprestimo, data: string): Form {
  return { id: null, devedor, tipo, data, grupo: "", produto: "", quantidade: "1", unidade: "UND", valor: "" };
}

function textoNumero(n: number | null): string {
  return n === null ? "" : String(n).replace(".", ",");
}

export default function Emprestimos() {
  const [lista, setLista] = useState<Emprestimo[] | null>(null);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [devedor, setDevedor] = useState<Devedor>("paulista");
  const [aba, setAba] = useState<Aba>("mercadoria");
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [pagando, setPagando] = useState<Emprestimo[] | null>(null);
  const [busca, setBusca] = useState("");
  const [mes, setMes] = useState("todos");

  const carregar = useCallback(async () => {
    try {
      if (!variaveisConfiguradas()) throw new Error("O banco de dados não está configurado.");
      setLista(await listarEmprestimos());
      setErro("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErro(
        /emprestimos/.test(msg)
          ? "A tabela de empréstimos ainda não existe no banco. Rode o arquivo supabase/emprestimos.sql no SQL Editor do Supabase."
          : msg,
      );
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(""), 3500);
    return () => clearTimeout(t);
  }, [aviso]);

  const hoje = hojeISO();

  const doDevedor = useMemo(() => (lista ?? []).filter((e) => e.devedor === devedor), [lista, devedor]);
  const abertos = useMemo(() => doDevedor.filter((e) => !e.pago_em), [doDevedor]);
  const pagos = useMemo(() => doDevedor.filter((e) => e.pago_em), [doDevedor]);

  const contagem = (d: Devedor) => {
    const itens = (lista ?? []).filter((e) => e.devedor === d && !e.pago_em);
    return { n: itens.length, total: itens.reduce((s, e) => s + totalDoItem(e), 0) };
  };

  const visiveis = useMemo(
    () => abertos.filter((e) => e.tipo === aba).sort((a, b) => a.data.localeCompare(b.data)),
    [abertos, aba],
  );
  const totalAberto = visiveis.reduce((s, e) => s + totalDoItem(e), 0);
  const semValor = visiveis.filter((e) => e.valor === null).length;

  // Sugestões para o formulário (grupos e produtos já usados).
  const sugestoes = useMemo(() => {
    const grupos = new Set<string>();
    const produtos = new Map<string, Emprestimo>();
    for (const e of lista ?? []) {
      grupos.add(e.grupo);
      const atual = produtos.get(e.produto);
      if (!atual || e.data >= atual.data) produtos.set(e.produto, e);
    }
    return {
      grupos: [...grupos].sort((a, b) => a.localeCompare(b, "pt-BR")),
      produtos,
    };
  }, [lista]);

  // Pagos: filtro por mês do pagamento e busca.
  const mesesPagos = useMemo(
    () => [...new Set(pagos.map((e) => (e.pago_em as string).slice(0, 7)))].sort().reverse(),
    [pagos],
  );
  const pagosVisiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return pagos
      .filter((e) => mes === "todos" || (e.pago_em as string).startsWith(mes))
      .filter((e) => !termo || `${e.produto} ${e.grupo}`.toLowerCase().includes(termo))
      .sort((a, b) => (b.pago_em as string).localeCompare(a.pago_em as string) || b.data.localeCompare(a.data));
  }, [pagos, mes, busca]);

  function trocarDevedor(d: Devedor) {
    setDevedor(d);
    setSelecionados([]);
    setMes("todos");
    setBusca("");
  }
  function trocarAba(a: Aba) {
    setAba(a);
    setSelecionados([]);
  }
  function alternarSelecao(id: string) {
    setSelecionados((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  function abrirNovo() {
    setErro("");
    setForm(formVazio(devedor, aba === "pagos" ? "mercadoria" : aba, hoje));
  }
  function abrirEdicao(e: Emprestimo) {
    setErro("");
    setForm({
      id: e.id,
      devedor: e.devedor,
      tipo: e.tipo,
      data: e.data,
      grupo: e.grupo,
      produto: e.produto,
      quantidade: textoNumero(e.quantidade),
      unidade: e.unidade ?? "",
      valor: textoNumero(e.valor),
    });
  }

  async function executar(acao: () => Promise<void>, mensagem: string) {
    try {
      await acao();
      await carregar();
      setAviso(mensagem);
      return true;
    } catch (e) {
      setErro("Não foi possível salvar. " + (e instanceof Error ? e.message : ""));
      return false;
    }
  }

  async function confirmarPagamento(itens: Emprestimo[], data: string, qtdParcial: number | null) {
    const unico = itens[0];
    const ok = await executar(async () => {
      if (itens.length === 1 && qtdParcial !== null && qtdParcial < unico.quantidade) {
        await pagarParte(unico, qtdParcial, data);
      } else {
        await pagarItens(itens.map((i) => i.id), data);
      }
    }, itens.length === 1 ? `Pago em ${dataBR(data)}` : `${itens.length} itens pagos em ${dataBR(data)}`);
    if (ok) {
      setPagando(null);
      setSelecionados([]);
    }
  }

  const resumoAbas: { id: Aba; rotulo: string; n: number }[] = [
    { id: "mercadoria", rotulo: "Mercadorias", n: abertos.filter((e) => e.tipo === "mercadoria").length },
    { id: "utensilio", rotulo: "Utensílios", n: abertos.filter((e) => e.tipo === "utensilio").length },
    { id: "pagos", rotulo: "Pagos", n: pagos.length },
  ];

  return (
    <div className={`space-y-4 ${selecionados.length > 0 ? "pb-28" : ""}`}>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Empréstimos</h1>
        <button className="botao" onClick={abrirNovo}>
          + Novo
        </button>
      </div>

      {aviso && (
        <p className="fixed left-1/2 top-24 z-40 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-xl bg-green-700 px-4 py-3 text-center font-semibold text-white shadow-lg">
          ✓ {aviso}
        </p>
      )}
      {erro && <p className="rounded-xl bg-red-50 p-3 text-red-700">{erro}</p>}
      {!lista && !erro && <p className="text-neutral-600">Carregando...</p>}

      {lista && (
        <>
          {/* Quem deve */}
          <div className="grid grid-cols-2 gap-2">
            {(["paulista", "jk"] as Devedor[]).map((d) => {
              const c = contagem(d);
              const ativo = d === devedor;
              return (
                <button
                  key={d}
                  onClick={() => trocarDevedor(d)}
                  className={`rounded-2xl border-2 p-3 text-left active:scale-[0.98] ${
                    ativo ? "text-white shadow" : "border-neutral-200 bg-white"
                  }`}
                  style={ativo ? { background: "var(--cor-principal)", borderColor: "var(--cor-principal)" } : undefined}
                >
                  <span className="block text-base font-bold">{NOME_DEVEDOR[d]}</span>
                  <span className="block text-lg font-bold">{formatarMoeda(c.total)}</span>
                  <span className={`block text-sm ${ativo ? "text-white/80" : "text-neutral-500"}`}>
                    {c.n} {c.n === 1 ? "item em aberto" : "itens em aberto"}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-sm text-neutral-600">{DE_PARA[devedor]}</p>

          {/* Mercadorias / Utensílios / Pagos */}
          <div className="grid grid-cols-3 gap-1 rounded-2xl bg-neutral-200/70 p-1">
            {resumoAbas.map((a) => (
              <button
                key={a.id}
                onClick={() => trocarAba(a.id)}
                className={`rounded-xl px-2 py-3 text-sm font-semibold ${
                  aba === a.id ? "bg-white shadow" : "text-neutral-700"
                }`}
              >
                {a.rotulo}
                <span className="ml-1 text-neutral-500">({a.n})</span>
              </button>
            ))}
          </div>

          {aba !== "pagos" && (
            <>
              <div className="cartao flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-neutral-600">TOTAL em aberto</p>
                  <p className="text-2xl font-bold">{formatarMoeda(totalAberto)}</p>
                  {semValor > 0 && (
                    <p className="text-xs text-neutral-500">
                      {semValor} {semValor === 1 ? "item sem valor" : "itens sem valor"} não entram na soma
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm text-neutral-600">Atualizado em</p>
                  <p className="font-bold">{dataBR(hoje)}</p>
                </div>
              </div>

              {visiveis.length === 0 && (
                <p className="cartao text-center text-neutral-600">
                  Nada em aberto aqui. Use <strong>+ Novo</strong> para lançar um empréstimo.
                </p>
              )}

              <ul className="space-y-3">
                {visiveis.map((e) => {
                  const dias = diasEmAtraso(e.data, hoje);
                  const marcado = selecionados.includes(e.id);
                  return (
                    <li
                      key={e.id}
                      className={`cartao ${marcado ? "!border-2" : ""}`}
                      style={marcado ? { borderColor: "var(--cor-principal)" } : undefined}
                    >
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => alternarSelecao(e.id)}
                          aria-label={marcado ? "Desmarcar" : "Marcar para pagar"}
                          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 text-lg font-bold text-white ${
                            marcado ? "" : "border-neutral-300 bg-white"
                          }`}
                          style={marcado ? { background: "var(--cor-principal)", borderColor: "var(--cor-principal)" } : undefined}
                        >
                          {marcado ? "✓" : ""}
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className="text-lg font-semibold leading-tight">{e.produto}</p>
                          <p className="text-sm text-neutral-600">
                            {e.grupo} · {dataCurta(e.data)}
                          </p>
                          <p className="mt-1 text-base">
                            {formatarQuantidade(e.quantidade)} {e.unidade ?? ""}
                            {e.valor !== null && (
                              <span className="text-neutral-600"> × {formatarMoeda(e.valor)}</span>
                            )}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold">
                            {e.valor !== null ? formatarMoeda(totalDoItem(e)) : "—"}
                          </p>
                          <p className={`text-sm font-semibold ${dias < 0 ? "text-red-600" : "text-neutral-600"}`}>
                            {dias === 0 ? "hoje" : `${dias} dias`}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button className="botao flex-1" onClick={() => setPagando([e])}>
                          Pagar
                        </button>
                        <button className="botao-secundario" onClick={() => abrirEdicao(e)}>
                          Editar
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {aba === "pagos" && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <input
                  className="campo"
                  type="search"
                  placeholder="Buscar produto"
                  value={busca}
                  onChange={(ev) => setBusca(ev.target.value)}
                />
                <select className="campo" value={mes} onChange={(ev) => setMes(ev.target.value)}>
                  <option value="todos">Todos os meses</option>
                  {mesesPagos.map((m) => (
                    <option key={m} value={m}>
                      {MESES[Number(m.slice(5)) - 1]} {m.slice(0, 4)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="cartao flex items-center justify-between">
                <div>
                  <p className="text-sm text-neutral-600">Total pago</p>
                  <p className="text-2xl font-bold">
                    {formatarMoeda(pagosVisiveis.reduce((s, e) => s + totalDoItem(e), 0))}
                  </p>
                </div>
                <p className="text-sm text-neutral-600">{pagosVisiveis.length} itens</p>
              </div>
              {pagosVisiveis.length === 0 && (
                <p className="cartao text-center text-neutral-600">Nenhum pagamento encontrado.</p>
              )}
              <ul className="space-y-3">
                {pagosVisiveis.map((e, i) => {
                  const mudouDia = i === 0 || pagosVisiveis[i - 1].pago_em !== e.pago_em;
                  return (
                    <li key={e.id} className="space-y-2">
                      {mudouDia && (
                        <p className="pt-2 text-sm font-bold text-green-800">
                          Pago em {dataBR(e.pago_em as string)}
                        </p>
                      )}
                      <div className="cartao">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-lg font-semibold leading-tight">{e.produto}</p>
                            <p className="text-sm text-neutral-600">
                              {e.grupo} · emprestado em {dataCurta(e.data)}
                              {e.tipo === "utensilio" ? " · utensílio" : ""}
                            </p>
                            <p>
                              {formatarQuantidade(e.quantidade)} {e.unidade ?? ""}
                            </p>
                            {e.observacao && (
                              <p className="text-sm italic text-neutral-500">“{e.observacao}”</p>
                            )}
                          </div>
                          <p className="text-lg font-bold">
                            {e.valor !== null ? formatarMoeda(totalDoItem(e)) : "—"}
                          </p>
                        </div>
                        <div className="mt-3 flex gap-2">
                          <button
                            className="botao-secundario flex-1"
                            onClick={() => {
                              if (confirm(`Desfazer o pagamento de ${e.produto}? Ele volta para a lista em aberto.`))
                                executar(() => desfazerPagamento(e.id), "Pagamento desfeito");
                            }}
                          >
                            Desfazer pagamento
                          </button>
                          <button className="botao-secundario" onClick={() => abrirEdicao(e)}>
                            Editar
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </>
      )}

      {/* Barra de pagamento em grupo */}
      {selecionados.length > 0 && lista && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-neutral-200 bg-white p-3 shadow-[0_-4px_12px_rgba(0,0,0,0.08)]">
          <div className="mx-auto flex max-w-3xl gap-2">
            <button className="botao-secundario" onClick={() => setSelecionados([])}>
              Limpar
            </button>
            <button
              className="botao flex-1"
              onClick={() => setPagando(lista.filter((e) => selecionados.includes(e.id)))}
            >
              Pagar {selecionados.length} {selecionados.length === 1 ? "item" : "itens"}
            </button>
          </div>
        </div>
      )}

      {pagando && (
        <FolhaPagamento
          itens={pagando}
          aoFechar={() => setPagando(null)}
          aoConfirmar={confirmarPagamento}
        />
      )}

      {form && (
        <FolhaFormulario
          inicial={form}
          grupos={sugestoes.grupos}
          produtos={sugestoes.produtos}
          aoFechar={() => setForm(null)}
          aoSalvar={async (f, outro) => {
            const dados = paraDados(f);
            if (!dados) return;
            const ok = await executar(
              () => (f.id ? editarEmprestimo(f.id, dados) : criarEmprestimo(dados)),
              f.id ? "Alterações salvas" : `${dados.produto} lançado`,
            );
            if (!ok) return;
            if (f.id || !outro) setForm(null);
            else
              setForm({
                ...formVazio(f.devedor, f.tipo, f.data),
                grupo: f.grupo,
              });
          }}
          aoExcluir={async (id) => {
            if (!confirm("Excluir este item de vez? Isso não tem volta.")) return;
            if (await executar(() => excluirEmprestimo(id), "Item excluído")) setForm(null);
          }}
        />
      )}
    </div>
  );
}

function paraDados(f: Form): DadosEmprestimo | null {
  const produto = f.produto.trim().toUpperCase();
  const grupo = f.grupo.trim().toUpperCase();
  const quantidade = lerNumero(f.quantidade);
  if (!produto || !grupo || !quantidade || quantidade <= 0) return null;
  return {
    data: f.data,
    devedor: f.devedor,
    tipo: f.tipo,
    grupo,
    produto,
    quantidade,
    unidade: f.unidade.trim().toUpperCase() || null,
    valor: lerNumero(f.valor),
  };
}

// ---------- Folha: pagar um ou vários itens ----------
function FolhaPagamento({
  itens,
  aoFechar,
  aoConfirmar,
}: {
  itens: Emprestimo[];
  aoFechar: () => void;
  aoConfirmar: (itens: Emprestimo[], data: string, qtdParcial: number | null) => Promise<void>;
}) {
  const [data, setData] = useState(hojeISO());
  const [qtd, setQtd] = useState(itens.length === 1 ? textoNumero(itens[0].quantidade) : "");
  const [salvando, setSalvando] = useState(false);
  const unico = itens.length === 1 ? itens[0] : null;
  const qtdNum = lerNumero(qtd);
  const qtdInvalida = unico !== null && (!qtdNum || qtdNum <= 0 || qtdNum > unico.quantidade);
  const total = itens.reduce((s, e) => s + totalDoItem(e), 0);

  return (
    <Folha titulo={unico ? "Registrar pagamento" : `Pagar ${itens.length} itens`} aoFechar={aoFechar}>
      <div className="space-y-4">
        <div className="rounded-xl bg-neutral-100 p-3 text-sm">
          {itens.slice(0, 6).map((e) => (
            <p key={e.id}>
              • {formatarQuantidade(e.quantidade)} {e.unidade ?? ""} {e.produto}
            </p>
          ))}
          {itens.length > 6 && <p>… e mais {itens.length - 6}</p>}
          {total > 0 && <p className="mt-1 font-bold">Total: {formatarMoeda(total)}</p>}
        </div>

        {unico && unico.quantidade > 1 && (
          <label className="block">
            <span className="mb-1 block text-sm font-medium">
              Quantidade paga (de {formatarQuantidade(unico.quantidade)})
            </span>
            <input
              className="campo"
              inputMode="decimal"
              value={qtd}
              onChange={(ev) => setQtd(ev.target.value)}
            />
            <span className="mt-1 block text-xs text-neutral-500">
              Se pagar só uma parte, o resto continua em aberto.
            </span>
          </label>
        )}

        <div>
          <p className="mb-2 text-sm font-medium">Data do pagamento</p>
          <Calendario valor={data} aoEscolher={setData} />
        </div>

        <button
          className="botao w-full"
          disabled={salvando || qtdInvalida}
          onClick={async () => {
            setSalvando(true);
            await aoConfirmar(itens, data, unico ? qtdNum : null);
            setSalvando(false);
          }}
        >
          {salvando ? "Salvando..." : `Confirmar pago em ${dataBR(data)}`}
        </button>
      </div>
    </Folha>
  );
}

// ---------- Folha: novo empréstimo / editar ----------
function Opcoes<T extends string>({
  rotulo,
  valor,
  opcoes,
  aoMudar,
}: {
  rotulo: string;
  valor: T;
  opcoes: { id: T; nome: string }[];
  aoMudar: (v: T) => void;
}) {
  return (
    <div>
      <span className="mb-1 block text-sm font-medium">{rotulo}</span>
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-neutral-200/70 p-1">
        {opcoes.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => aoMudar(o.id)}
            className={`rounded-lg px-2 py-3 text-sm font-semibold ${
              valor === o.id ? "bg-white shadow" : "text-neutral-700"
            }`}
          >
            {o.nome}
          </button>
        ))}
      </div>
    </div>
  );
}

function FolhaFormulario({
  inicial,
  grupos,
  produtos,
  aoFechar,
  aoSalvar,
  aoExcluir,
}: {
  inicial: Form;
  grupos: string[];
  produtos: Map<string, Emprestimo>;
  aoFechar: () => void;
  aoSalvar: (f: Form, adicionarOutro: boolean) => Promise<void>;
  aoExcluir: (id: string) => Promise<void>;
}) {
  const [f, setF] = useState<Form>(inicial);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState("");

  function mudarProduto(texto: string) {
    const anterior = produtos.get(texto.trim().toUpperCase());
    // Ao escolher um produto já conhecido, sugere grupo, unidade e último valor.
    if (anterior && !f.id) {
      setF({
        ...f,
        produto: texto,
        grupo: anterior.grupo,
        unidade: anterior.unidade ?? f.unidade,
        valor: f.valor || textoNumero(anterior.valor),
      });
    } else setF({ ...f, produto: texto });
  }

  async function enviar(outro: boolean) {
    if (!paraDados(f)) {
      setAviso("Preencha o grupo, o produto e uma quantidade maior que zero.");
      return;
    }
    setAviso("");
    setSalvando(true);
    await aoSalvar(f, outro);
    setSalvando(false);
  }

  return (
    <Folha titulo={f.id ? "Editar item" : "Novo empréstimo"} aoFechar={aoFechar}>
      <form
        className="space-y-4"
        onSubmit={(ev) => {
          ev.preventDefault();
          enviar(false);
        }}
      >
        <Opcoes
          rotulo="Quem deve pagar"
          valor={f.devedor}
          opcoes={[
            { id: "paulista", nome: "Paulista" },
            { id: "jk", nome: "JK" },
          ]}
          aoMudar={(devedor) => setF({ ...f, devedor })}
        />
        <Opcoes
          rotulo="Tipo"
          valor={f.tipo}
          opcoes={[
            { id: "mercadoria", nome: "Mercadoria" },
            { id: "utensilio", nome: "Utensílio" },
          ]}
          aoMudar={(tipo) => setF({ ...f, tipo })}
        />
        <CampoData rotulo="Data do empréstimo" valor={f.data} aoMudar={(data) => setF({ ...f, data })} />

        <label className="block">
          <span className="mb-1 block text-sm font-medium">Produto</span>
          <input
            className="campo uppercase"
            list="lista-produtos"
            value={f.produto}
            onChange={(ev) => mudarProduto(ev.target.value)}
            placeholder="Ex.: ENDIVIA"
            autoComplete="off"
            autoFocus={!f.id}
          />
          <datalist id="lista-produtos">
            {[...produtos.keys()].sort().map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">Grupo</span>
          <input
            className="campo uppercase"
            list="lista-grupos"
            value={f.grupo}
            onChange={(ev) => setF({ ...f, grupo: ev.target.value })}
            placeholder="Ex.: HORT"
            autoComplete="off"
          />
          <datalist id="lista-grupos">
            {grupos.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Quantidade</span>
            <input
              className="campo"
              inputMode="decimal"
              value={f.quantidade}
              onChange={(ev) => setF({ ...f, quantidade: ev.target.value })}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Valor de 1 unidade (R$)</span>
            <input
              className="campo"
              inputMode="decimal"
              value={f.valor}
              onChange={(ev) => setF({ ...f, valor: ev.target.value })}
              placeholder="opcional"
            />
          </label>
        </div>

        <div>
          <span className="mb-1 block text-sm font-medium">Unidade</span>
          <div className="flex flex-wrap gap-2">
            {UNIDADES.map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setF({ ...f, unidade: u })}
                className={`rounded-full border px-4 py-2 text-sm font-semibold ${
                  f.unidade === u ? "text-white" : "border-neutral-300 bg-white"
                }`}
                style={f.unidade === u ? { background: "var(--cor-principal)", borderColor: "var(--cor-principal)" } : undefined}
              >
                {u}
              </button>
            ))}
          </div>
        </div>

        {(() => {
          const q = lerNumero(f.quantidade);
          const v = lerNumero(f.valor);
          return q && v ? (
            <p className="rounded-xl bg-neutral-100 p-3 text-center font-bold">
              Total: {formatarMoeda(q * v)}
            </p>
          ) : null;
        })()}

        {aviso && <p className="rounded-xl bg-red-50 p-3 text-red-700">{aviso}</p>}

        {f.id ? (
          <div className="flex gap-2">
            <button className="botao flex-1" disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar"}
            </button>
            <button
              type="button"
              className="botao-secundario !border-red-600 !text-red-600"
              onClick={() => aoExcluir(f.id as string)}
            >
              Excluir
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <button type="button" className="botao w-full" disabled={salvando} onClick={() => enviar(true)}>
              {salvando ? "Salvando..." : "Salvar e lançar outro"}
            </button>
            <button type="submit" className="botao-secundario w-full" disabled={salvando}>
              Salvar e fechar
            </button>
          </div>
        )}
      </form>
    </Folha>
  );
}
