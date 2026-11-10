// Desenha a tabela de empréstimos em uma imagem PNG, no estilo da planilha do Excel,
// para enviar nos grupos. Não depende de nenhuma biblioteca: usa só o canvas do navegador.

export type LinhaImagem = {
  data: string; // "29/jun"
  grupo: string;
  produto: string;
  quantidade: string; // "0,5"
  unidade: string;
  valor: number | null; // valor de 1 unidade
  total: number | null;
  dias: number; // negativo = dias em atraso
};

export type DadosImagem = {
  titulo: string;
  linhas: LinhaImagem[];
  total: number;
  atualizadoEm: string; // "09/11/2026"
};

type Coluna = { nome: string; largura: number; alinhar: "center" | "left" | "moeda" };

const COLUNAS: Coluna[] = [
  { nome: "DATA", largura: 78, alinhar: "center" },
  { nome: "Grupo", largura: 150, alinhar: "center" },
  { nome: "PRODUTO", largura: 310, alinhar: "left" },
  { nome: "QTD", largura: 60, alinhar: "center" },
  { nome: "UN/KG", largura: 70, alinhar: "center" },
  { nome: "VALOR", largura: 110, alinhar: "moeda" },
  { nome: "TOTAL", largura: 110, alinhar: "moeda" },
  { nome: "DIAS EM ATRASO", largura: 150, alinhar: "center" },
];

const COR = {
  titulo: "#DDEBF7",
  cabecalho: "#9DC3E6",
  linhas: "#E2EFDA",
  vermelho: "#E00000",
  texto: "#000000",
};

const numero = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const FONTE = "Calibri, Carlito, Arial, sans-serif";

export function gerarImagemTabela(dados: DadosImagem): Promise<Blob> {
  const escala = 2; // imagem nítida no celular
  const larg = COLUNAS.reduce((s, c) => s + c.largura, 0);
  const altTitulo = 44;
  const altCab = 30;
  const altLinha = 28;
  const altTotal = 34;
  const folga = 14;
  const alt = altTitulo + altCab + dados.linhas.length * altLinha + folga + altTotal + folga;

  const canvas = document.createElement("canvas");
  canvas.width = larg * escala;
  canvas.height = alt * escala;
  const c = canvas.getContext("2d");
  if (!c) return Promise.reject(new Error("Seu navegador não conseguiu desenhar a imagem."));
  c.scale(escala, escala);

  // Fundo branco e faixas
  c.fillStyle = "#FFFFFF";
  c.fillRect(0, 0, larg, alt);
  c.fillStyle = COR.titulo;
  c.fillRect(0, 0, larg, altTitulo);
  c.fillStyle = COR.cabecalho;
  c.fillRect(0, altTitulo, larg, altCab);
  const fimLinhas = altTitulo + altCab + dados.linhas.length * altLinha + folga;
  c.fillStyle = COR.linhas;
  c.fillRect(0, altTitulo + altCab, larg, fimLinhas - altTitulo - altCab);
  c.textBaseline = "middle";

  // Título
  c.fillStyle = COR.texto;
  c.font = `bold 24px ${FONTE}`;
  c.textAlign = "center";
  c.fillText(dados.titulo, larg / 2, altTitulo / 2 + 1);

  // Cabeçalho
  c.font = `bold 15px ${FONTE}`;
  let x = 0;
  for (const col of COLUNAS) {
    c.textAlign = "center";
    c.fillText(col.nome, x + col.largura / 2, altTitulo + altCab / 2 + 1);
    x += col.largura;
  }

  // Linhas
  const posX = (i: number) => COLUNAS.slice(0, i).reduce((s, k) => s + k.largura, 0);
  dados.linhas.forEach((l, i) => {
    const y = altTitulo + altCab + i * altLinha;
    const meio = y + altLinha / 2 + 1;
    const textos = [l.data, l.grupo, l.produto, l.quantidade, l.unidade];
    c.font = `15px ${FONTE}`;
    c.fillStyle = COR.texto;
    textos.forEach((t, k) => {
      const col = COLUNAS[k];
      if (col.alinhar === "left") {
        c.textAlign = "left";
        c.fillText(t, posX(k) + 8, meio);
      } else {
        c.textAlign = "center";
        c.fillText(t, posX(k) + col.largura / 2, meio);
      }
    });
    // VALOR e TOTAL: "R$" na esquerda, número na direita, linha embaixo
    [l.valor, l.total].forEach((v, j) => {
      const k = 5 + j;
      const col = COLUNAS[k];
      if (v !== null || j === 1) {
        c.textAlign = "left";
        c.fillText("R$", posX(k) + 8, meio);
        c.textAlign = "right";
        c.fillText(v === null ? "-" : numero.format(v), posX(k) + col.largura - 8, meio);
      }
      c.fillStyle = COR.texto;
      c.fillRect(posX(k), y + altLinha - 1, col.largura, 1);
    });
    // Dias em atraso (vermelho)
    c.fillStyle = COR.vermelho;
    c.textAlign = "center";
    c.fillText(String(l.dias), posX(7) + COLUNAS[7].largura / 2, meio);
    c.fillStyle = COR.texto;
  });

  // Linha do total: caixa em VALOR+TOTAL e a data de atualização
  const yTotal = fimLinhas;
  const xCaixa = posX(5);
  const largCaixa = COLUNAS[5].largura + COLUNAS[6].largura;
  c.fillStyle = "#FFFFFF";
  c.fillRect(xCaixa, yTotal, largCaixa, altTotal);
  c.strokeStyle = COR.texto;
  c.lineWidth = 1.5;
  c.strokeRect(xCaixa + 0.75, yTotal + 0.75, largCaixa - 1.5, altTotal - 1.5);
  c.fillStyle = COR.texto;
  c.font = `bold 15px ${FONTE}`;
  c.textAlign = "left";
  c.fillText("TOTAL =", xCaixa + 8, yTotal + altTotal / 2 + 1);
  c.textAlign = "right";
  c.fillText(`R$ ${numero.format(dados.total)}`, xCaixa + largCaixa - 8, yTotal + altTotal / 2 + 1);
  c.fillStyle = COR.titulo;
  c.fillRect(posX(7), yTotal, COLUNAS[7].largura, altTotal);
  c.fillStyle = COR.texto;
  c.textAlign = "center";
  c.fillText(dados.atualizadoEm, posX(7) + COLUNAS[7].largura / 2, yTotal + altTotal / 2 + 1);

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Não foi possível gerar a imagem."))), "image/png"),
  );
}

export function baixarImagem(imagem: Blob, nomeArquivo: string) {
  const url = URL.createObjectURL(imagem);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Abre o compartilhamento do celular (WhatsApp etc.). Devolve false se o aparelho não permite. */
export function podeCompartilhar(imagem: Blob, nomeArquivo: string): boolean {
  if (typeof navigator === "undefined" || !navigator.canShare) return false;
  return navigator.canShare({ files: [new File([imagem], nomeArquivo, { type: "image/png" })] });
}

export async function compartilharImagem(imagem: Blob, nomeArquivo: string, titulo: string) {
  const arquivo = new File([imagem], nomeArquivo, { type: "image/png" });
  try {
    await navigator.share({ files: [arquivo], title: titulo });
  } catch (e) {
    // Fechar a janela de compartilhar não é erro.
    if (!(e instanceof DOMException && e.name === "AbortError")) throw e;
  }
}
