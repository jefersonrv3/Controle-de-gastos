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

  // --- Editar Conta (renomear / adicionar saldo / excluir) ---
  const dialogEditarConta = document.getElementById('dialog-editar-conta');

  // Guarda qual conta está sendo editada no momento. Usamos uma variável
  // "fora" do listener porque o clique que ABRE o modal (no card) e o
  // submit que SALVA (no form) são dois eventos separados no tempo —
  // precisamos lembrar o id da conta entre um evento e outro.
  let contaEmEdicaoId = null;

  // Delegação de evento: os botões ".btn-editar-conta" são criados
  // dinamicamente dentro dos cards (ver ui.js), então escutamos o clique
  // no container pai fixo (#lista-contas), igual já fazemos em #lista-dividas.
  document.getElementById('lista-contas').addEventListener('click', (evento) => {
    const botao = evento.target.closest('.btn-editar-conta');
    if (!botao) return;

    contaEmEdicaoId = botao.dataset.contaId;
    const conta = contas.find((c) => c.id === contaEmEdicaoId);

    // Pré-preenche o formulário com os dados atuais da conta
    document.getElementById('editar-conta-nome').value = conta.nome;
    document.getElementById('editar-conta-adicionar-saldo').value = '0';

    dialogEditarConta.showModal();
  });

  document.getElementById('btn-cancelar-editar-conta').addEventListener('click', () => {
    dialogEditarConta.close();
  });

  document.getElementById('form-editar-conta').addEventListener('submit', (evento) => {
    evento.preventDefault();

    const conta = contas.find((c) => c.id === contaEmEdicaoId);
    const novoNome = document.getElementById('editar-conta-nome').value;
    const valorAdicionar = Number(document.getElementById('editar-conta-adicionar-saldo').value);

    conta.nome = novoNome;
    conta.saldo += valorAdicionar; // soma (ou subtrai, se o número for negativo)
    saveContas(contas);

    dialogEditarConta.close();
    renderizarTudo();
  });

  // Excluir conta: ação destrutiva, então pedimos confirmação explícita.
  document.getElementById('btn-excluir-conta').addEventListener('click', () => {
    const confirmou = confirm(
      'Excluir esta conta também apaga todos os lançamentos ligados a ela. Deseja continuar?'
    );
    if (!confirmou) return;

    // Decisão de design: exclusão em CASCATA. Não faria sentido manter
    // lançamentos "órfãos" apontando pra uma conta que não existe mais
    // (o histórico ficaria com uma conta fantasma). Por isso filtramos
    // (removemos) também os lançamentos dessa conta.
    contas = contas.filter((c) => c.id !== contaEmEdicaoId);
    lancamentos = lancamentos.filter((l) => l.contaId !== contaEmEdicaoId);

    saveContas(contas);
    saveLancamentos(lancamentos);

    dialogEditarConta.close();
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

  // --- Excluir Lançamento ("desfazer") ---
  // Mesma técnica de delegação: os <li> do histórico são gerados
  // dinamicamente, então escutamos no <ul> pai fixo (#lista-historico).
  document.getElementById('lista-historico').addEventListener('click', (evento) => {
    const botao = evento.target.closest('.btn-excluir-lancamento');
    if (!botao) return;

    const lancamentoId = botao.dataset.lancamentoId;
    const lancamento = lancamentos.find((l) => l.id === lancamentoId);

    const confirmou = confirm(`Excluir o lançamento "${lancamento.descricao}"?`);
    if (!confirmou) return;

    // "Desfazer de verdade": como o lançamento tinha SUBTRAÍDO o valor
    // da conta na hora de criar, excluir precisa DEVOLVER esse valor —
    // senão o saldo da conta ficaria errado (menor do que deveria).
    const conta = contas.find((c) => c.id === lancamento.contaId);
    if (conta) {
      conta.saldo += lancamento.valor;
      saveContas(contas);
    }

    lancamentos = lancamentos.filter((l) => l.id !== lancamentoId);
    saveLancamentos(lancamentos);

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

  // --- Ações dentro dos cards de dívida: pagar parcela, desfazer, excluir ---
  // Os três botões (.btn-pagar-parcela, .btn-desfazer-parcela, .btn-excluir-divida)
  // são criados dinamicamente pelo ui.js, então usamos a MESMA técnica de
  // delegação: um único listener no container pai fixo (#lista-dividas)
  // que verifica QUAL botão foi clicado dentro dele.
  document.getElementById('lista-dividas').addEventListener('click', (evento) => {
    // --- Marcar parcela como paga ---
    const botaoPagar = evento.target.closest('.btn-pagar-parcela');
    if (botaoPagar) {
      const dividaId = botaoPagar.dataset.dividaId;
      const divida = dividas.find((d) => d.id === dividaId);

      // Adiciona o índice da próxima parcela ao array de pagas.
      // Ex: se já tem [0], a próxima a entrar é o índice 1 (2ª parcela).
      divida.parcelasPagas.push(divida.parcelasPagas.length);
      saveDividas(dividas);

      renderizarTudo();
      return; // evita cair nos próximos "if" à toa
    }

    // --- Desfazer última parcela paga ---
    const botaoDesfazer = evento.target.closest('.btn-desfazer-parcela');
    if (botaoDesfazer) {
      const dividaId = botaoDesfazer.dataset.dividaId;
      const divida = dividas.find((d) => d.id === dividaId);

      // .pop() remove o ÚLTIMO item do array e o devolve — exatamente
      // o oposto do .push() usado ao marcar como paga. Isso garante que
      // "desfazer" sempre reverte a parcela mais recentemente marcada,
      // não uma aleatória.
      divida.parcelasPagas.pop();
      saveDividas(dividas);

      renderizarTudo();
      return;
    }

    // --- Excluir dívida ---
    const botaoExcluir = evento.target.closest('.btn-excluir-divida');
    if (botaoExcluir) {
      const dividaId = botaoExcluir.dataset.dividaId;
      const divida = dividas.find((d) => d.id === dividaId);

      const confirmou = confirm(`Excluir a dívida "${divida.descricao}"? Essa ação não pode ser desfeita.`);
      if (!confirmou) return;

      dividas = dividas.filter((d) => d.id !== dividaId);
      saveDividas(dividas);

      renderizarTudo();
    }
  });

}

/* ------------------------------------------------------------
   PONTO DE ENTRADA
   'DOMContentLoaded' garante que todo o HTML já foi processado
   pelo navegador antes de tentarmos pegar elementos com getElementById.
   ------------------------------------------------------------ */
document.addEventListener('DOMContentLoaded', iniciar);
