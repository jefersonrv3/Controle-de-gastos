/* ============================================================
   app.js

   RESPONSABILIDADE deste arquivo: ser o "maestro" da aplicação.
   Ele é o ÚNICO arquivo que:
   - escuta eventos (cliques, submits de formulário)
   - decide o que fazer com esses eventos (chamando funções do models.js)
   - manda salvar (storage.js)
   - manda redesenhar a tela (ui.js)

   Fluxo típico de qualquer ação no app:
   evento do usuário -> ler dados atuais -> criar/alterar dado (models.js)
   -> salvar (storage.js) -> re-renderizar tudo (ui.js)
   ============================================================ */

/* ------------------------------------------------------------
   ESTADO EM MEMÓRIA
   Mantemos os arrays também em variáveis JS (não só no localStorage)
   pra não precisar ficar lendo o storage inteiro a cada clique.
   Toda vez que uma dessas listas muda, chamamos salvar() + renderizarTudo().
   ------------------------------------------------------------ */
let contas = [];
let lancamentos = [];
let dividas = [];

/**
 * Função central de re-renderização. Chamada depois de QUALQUER
 * alteração nos dados, garantindo que a tela nunca fique "desatualizada"
 * em relação ao que está salvo.
 */
function renderizarTudo() {
  renderContas(contas);
  renderSaldoTotal(contas);
  renderSelectContas(contas);
  renderHistorico(lancamentos, contas);
  renderDividas(dividas);
}

/* ------------------------------------------------------------
   INICIALIZAÇÃO
   Roda uma vez, quando a página termina de carregar.
   ------------------------------------------------------------ */
function iniciar() {
  // Carrega tudo que já existe no localStorage (na primeira vez que o
  // usuário abre o app, esses arrays vêm vazios — ver storage.js).
  contas = getContas();
  lancamentos = getLancamentos();
  dividas = getDividas();

  renderizarTudo();
  registrarEventos();
}

/* ------------------------------------------------------------
   REGISTRO DE EVENTOS
   Centralizar todos os addEventListener numa função só facilita
   ver, de relance, TODAS as interações que o app suporta.
   ------------------------------------------------------------ */
function registrarEventos() {
  // --- Nova Conta ---
  const dialogNovaConta = document.getElementById('dialog-nova-conta');

  document.getElementById('btn-nova-conta').addEventListener('click', () => {
    dialogNovaConta.showModal(); // método nativo do <dialog>, abre como modal
  });

  document.getElementById('btn-cancelar-conta').addEventListener('click', () => {
    dialogNovaConta.close();
  });

  document.getElementById('form-nova-conta').addEventListener('submit', (evento) => {
    // preventDefault: impede o comportamento padrão do form (recarregar a página)
    evento.preventDefault();

    const nome = document.getElementById('conta-nome').value;
    const saldo = document.getElementById('conta-saldo').value;

    const novaConta = criarConta(nome, saldo);
    contas.push(novaConta);
    saveContas(contas);

    evento.target.reset(); // limpa os campos do formulário
    dialogNovaConta.close();
    renderizarTudo();
  });

  // --- Novo Lançamento ---
  document.getElementById('form-lancamento').addEventListener('submit', (evento) => {
    evento.preventDefault();

    const contaId = document.getElementById('lancamento-conta').value;
    const descricao = document.getElementById('lancamento-descricao').value;
    const valor = document.getElementById('lancamento-valor').value;

    if (!contaId) {
      // Guarda de segurança: se não existir conta nenhuma, o select fica
      // vazio (value="") e não faz sentido criar um lançamento "órfão".
      alert('Cadastre uma conta antes de lançar um gasto.');
      return;
    }

    const novoLancamento = criarLancamento(contaId, descricao, valor);
    lancamentos.push(novoLancamento);
    saveLancamentos(lancamentos);

    // Regra de negócio: todo lançamento é uma SAÍDA, então subtrai
    // o valor do saldo da conta selecionada.
    const conta = contas.find((c) => c.id === contaId);
    conta.saldo -= Number(valor);
    saveContas(contas);

    evento.target.reset();
    renderizarTudo();
  });

  // --- Nova Dívida ---
  const dialogNovaDivida = document.getElementById('dialog-nova-divida');

  document.getElementById('btn-nova-divida').addEventListener('click', () => {
    dialogNovaDivida.showModal();
  });

  document.getElementById('btn-cancelar-divida').addEventListener('click', () => {
    dialogNovaDivida.close();
  });

  document.getElementById('form-nova-divida').addEventListener('submit', (evento) => {
    evento.preventDefault();

    const descricao = document.getElementById('divida-descricao').value;
    const valorTotal = document.getElementById('divida-valor-total').value;
    const numParcelas = document.getElementById('divida-parcelas').value;
    const primeiroVencimento = document.getElementById('divida-primeiro-vencimento').value;

    const novaDivida = criarDivida(descricao, valorTotal, numParcelas, primeiroVencimento);
    dividas.push(novaDivida);
    saveDividas(dividas);

    evento.target.reset();
    dialogNovaDivida.close();
    renderizarTudo();
  });

  // --- Marcar parcela como paga ---
  // Os botões ".btn-pagar-parcela" são criados DINAMICAMENTE pelo ui.js
  // (dentro de renderDividas), então NÃO existem no HTML quando a página
  // carrega — não dá pra usar addEventListener neles diretamente aqui.
  //
  // A solução é "delegação de eventos": escutamos o clique no elemento
  // PAI fixo (#lista-dividas, que sempre existe) e verificamos se o
  // clique aconteceu dentro de um botão .btn-pagar-parcela.
  document.getElementById('lista-dividas').addEventListener('click', (evento) => {
    const botao = evento.target.closest('.btn-pagar-parcela');
    if (!botao) return; // clique não foi em um botão de pagar parcela, ignora

    const dividaId = botao.dataset.dividaId;
    const divida = dividas.find((d) => d.id === dividaId);

    // Adiciona o índice da próxima parcela ao array de pagas.
    // Ex: se já tem [0], a próxima a entrar é o índice 1 (2ª parcela).
    divida.parcelasPagas.push(divida.parcelasPagas.length);
    saveDividas(dividas);

    renderizarTudo();
  });
}

/* ------------------------------------------------------------
   PONTO DE ENTRADA
   'DOMContentLoaded' garante que todo o HTML já foi processado
   pelo navegador antes de tentarmos pegar elementos com getElementById.
   ------------------------------------------------------------ */
document.addEventListener('DOMContentLoaded', iniciar);