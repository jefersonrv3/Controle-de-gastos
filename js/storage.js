/* ============================================================
   storage.js
   
   RESPONSABILIDADE ÚNICA deste arquivo: ler e escrever no localStorage.
   Nenhum outro arquivo (models.js, ui.js, app.js) deve chamar
   localStorage.getItem/setItem diretamente — sempre passam por aqui.

   Por quê isso importa? Se um dia você quiser trocar localStorage por
   IndexedDB, ou por uma API de verdade, só precisa reescrever ESTE
   arquivo. O resto do app nem percebe a diferença, porque só conhece
   as funções abaixo (ex: getContas(), saveContas()), não o mecanismo
   por trás delas.
   ============================================================ */

/* Chaves usadas no localStorage. Centralizadas num objeto pra evitar
   erro de digitação (ex: escrever "contass" em um lugar e "contas" em outro,
   o que faria o app "perder" dados silenciosamente). */
const STORAGE_KEYS = {
  CONTAS: 'controle-gastos:contas',
  LANCAMENTOS: 'controle-gastos:lancamentos',
  DIVIDAS: 'controle-gastos:dividas',
  RECEBIVEIS: 'controle-gastos:recebiveis',
};

/* ------------------------------------------------------------
   Funções genéricas de leitura/escrita.
   O localStorage só guarda STRING, por isso todo objeto/array
   precisa passar por JSON.stringify() antes de salvar e
   JSON.parse() depois de ler.
   ------------------------------------------------------------ */

/**
 * Lê uma chave do localStorage e converte de volta pra array/objeto.
 * Se a chave não existir ainda (primeiro uso do app), retorna um
 * array vazio — assim o resto do código nunca precisa checar "undefined".
 */
function lerDoStorage(chave) {
  const bruto = localStorage.getItem(chave);

  // Se nunca foi salvo nada nessa chave, getItem retorna null.
  if (bruto === null) {
    return [];
  }

  try {
    return JSON.parse(bruto);
  } catch (erro) {
    // Se por algum motivo o conteúdo salvo estiver corrompido/inválido,
    // preferimos "começar do zero" a quebrar o app inteiro.
    console.error(`Erro ao ler "${chave}" do localStorage:`, erro);
    return [];
  }
}

/**
 * Converte o valor pra string JSON e salva no localStorage.
 */
function salvarNoStorage(chave, valor) {
  localStorage.setItem(chave, JSON.stringify(valor));
}

/* ------------------------------------------------------------
   Funções específicas por entidade.
   São essas que o resto do app (models.js, app.js) realmente usa.
   Ter uma função por entidade (em vez de chamar lerDoStorage direto
   em todo lugar) deixa o código que USA storage.js mais legível:
   "getContas()" já diz o que faz, sem precisar saber a chave usada.
   ------------------------------------------------------------ */

function getContas() {
  return lerDoStorage(STORAGE_KEYS.CONTAS);
}

function saveContas(contas) {
  salvarNoStorage(STORAGE_KEYS.CONTAS, contas);
}

function getLancamentos() {
  return lerDoStorage(STORAGE_KEYS.LANCAMENTOS);
}

function saveLancamentos(lancamentos) {
  salvarNoStorage(STORAGE_KEYS.LANCAMENTOS, lancamentos);
}

function getDividas() {
  return lerDoStorage(STORAGE_KEYS.DIVIDAS);
}

function saveDividas(dividas) {
  salvarNoStorage(STORAGE_KEYS.DIVIDAS, dividas);
}

function getRecebiveis() {
  return lerDoStorage(STORAGE_KEYS.RECEBIVEIS);
}

function saveRecebiveis(recebiveis) {
  salvarNoStorage(STORAGE_KEYS.RECEBIVEIS, recebiveis);
}