/* ============================================================
   models.js

   RESPONSABILIDADE deste arquivo: definir o FORMATO dos dados
   (o que é uma "Conta", um "Lançamento", uma "Dívida") e as regras
   de negócio que dependem só desses dados — sem tocar em DOM,
   sem tocar em localStorage. É "lógica pura".

   Isso facilita explicar pro recrutador: "essa parte eu consigo
   testar sem precisar de navegador nenhum, porque não depende de tela".
   ============================================================ */

/**
 * Gera um ID simples e único o suficiente pra esse projeto.
 * Combina o timestamp atual (sempre crescente) com um número aleatório,
 * então a chance de colisão é desprezível pra um app local de 1 usuário.
 * (Em um sistema com backend/múltiplos usuários, isso normalmente
 * seria gerado pelo servidor ou com a lib "uuid".)
 */
function gerarId() {
  return `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

/* ------------------------------------------------------------
   CONTA
   { id, nome, saldo }
   ------------------------------------------------------------ */
function criarConta(nome, saldoInicial) {
  return {
    id: gerarId(),
    nome: nome,
    saldo: Number(saldoInicial), // garante que é número, mesmo vindo de um <input> (que retorna string)
  };
}

/* ------------------------------------------------------------
   LANÇAMENTO
   { id, contaId, descricao, valor, data }
   A data é capturada AQUI, na criação do objeto — nunca digitada
   pelo usuário, conforme a regra do projeto.
   ------------------------------------------------------------ */
function criarLancamento(contaId, descricao, valor) {
  return {
    id: gerarId(),
    contaId: contaId,
    descricao: descricao,
    valor: Number(valor),
    data: new Date().toISOString(), // formato universal (ISO), fácil de comparar/ordenar depois
  };
}

/* ------------------------------------------------------------
   DÍVIDA
   { id, descricao, valorTotal, numParcelas, primeiroVencimento, parcelasPagas }

   parcelasPagas: array de índices já quitados, ex: [0, 1] significa
   que as parcelas 1 e 2 (índice 0 e 1) já foram pagas.
   Guardamos um array (não só um "contador") porque isso permite no
   futuro saber EXATAMENTE quais parcelas foram pagas e quando, se
   você quiser evoluir o projeto.
   ------------------------------------------------------------ */
function criarDivida(descricao, valorTotal, numParcelas, primeiroVencimento) {
  return {
    id: gerarId(),
    descricao: descricao,
    valorTotal: Number(valorTotal),
    numParcelas: Number(numParcelas),
    primeiroVencimento: primeiroVencimento, // string no formato "YYYY-MM-DD", vem do <input type="date">
    parcelasPagas: [],
  };
}

/* ------------------------------------------------------------
   REGRAS DE CÁLCULO DE DÍVIDA
   Centralizar esses cálculos aqui (em vez de espalhar contas de
   data pelo ui.js) é o que torna fácil de testar e de explicar:
   "toda a matemática da dívida mora nessas 4 funções".
   ------------------------------------------------------------ */

/** Valor de cada parcela (divisão simples do total pelo número de parcelas). */
function calcularValorParcela(divida) {
  return divida.valorTotal / divida.numParcelas;
}

/** Quantas parcelas ainda faltam pagar. */
function calcularParcelasRestantes(divida) {
  return divida.numParcelas - divida.parcelasPagas.length;
}

/**
 * Calcula a data de vencimento da PRÓXIMA parcela não paga.
 * Lógica: pega a data do primeiro vencimento e soma 1 mês pra cada
 * parcela já paga. Ex: se 2 parcelas já foram pagas, a próxima
 * vence 2 meses depois da data original.
 */
function calcularProximoVencimento(divida) {
  const dataBase = new Date(divida.primeiroVencimento);
  const parcelasJaPagas = divida.parcelasPagas.length;

  // setMonth soma meses "estourando" o ano automaticamente
  // (ex: mês 13 vira janeiro do ano seguinte) — não precisamos tratar isso na mão.
  const proximaData = new Date(dataBase);
  proximaData.setMonth(dataBase.getMonth() + parcelasJaPagas);

  return proximaData;
}

/**
 * Diferença em DIAS entre hoje e o próximo vencimento.
 * Número negativo = já venceu. Número positivo = ainda vai vencer.
 */
function calcularDiasParaVencimento(divida) {
  const hoje = new Date();
  const vencimento = calcularProximoVencimento(divida);

  // Zeramos a hora dos dois lados pra comparar só a DATA, não o horário exato
  // (senão "hoje às 14h" vs "vencimento hoje às 00h" dava 0.4 dias em vez de 0).
  hoje.setHours(0, 0, 0, 0);
  vencimento.setHours(0, 0, 0, 0);

  const diferencaEmMilissegundos = vencimento - hoje;
  const diferencaEmDias = diferencaEmMilissegundos / (1000 * 60 * 60 * 24);

  return Math.round(diferencaEmDias);
}

/**
 * Retorna se a dívida já foi TOTALMENTE quitada.
 */
function dividaQuitada(divida) {
  return divida.parcelasPagas.length >= divida.numParcelas;
}