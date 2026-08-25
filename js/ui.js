/* ============================================================
   ui.js

   RESPONSABILIDADE deste arquivo: pegar dados já prontos (arrays de
   conta/lançamento/dívida) e transformar em HTML na tela.
   Este arquivo NÃO decide regras de negócio (isso é o models.js)
   e NÃO mexe no localStorage (isso é o storage.js) — só desenha.

   Padrão usado: cada função "render" limpa o container e reconstrói
   o HTML do zero a partir do array atual. É mais simples de entender
   e depurar que ficar adicionando/removendo elementos um por um,
   e pra volume de dados de um app pessoal, a diferença de performance
   é irrelevante.
   ============================================================ */

/* ------------------------------------------------------------
   Helpers de formatação — usados em vários renders, por isso
   ficam centralizados aqui em vez de repetidos.
   ------------------------------------------------------------ */

/** Formata número pra moeda brasileira: 1500.5 -> "R$ 1.500,50" */
function formatarMoeda(valor) {
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

/** Formata uma data (Date ou string ISO) pro padrão brasileiro dd/mm/aaaa */
function formatarData(data) {
  const dataObj = data instanceof Date ? data : new Date(data);
  return dataObj.toLocaleDateString('pt-BR');
}

/* ------------------------------------------------------------
   RENDER: CONTAS
   ------------------------------------------------------------ */

function renderContas(contas) {
  const container = document.getElementById('lista-contas');
  container.innerHTML = ''; // limpa antes de redesenhar, evita duplicar cards

  if (contas.length === 0) {
    container.innerHTML = '<p>Nenhuma conta cadastrada ainda.</p>';
    return;
  }

  contas.forEach((conta) => {
    const card = document.createElement('div');
    card.className = 'card-conta';
    card.dataset.contaId = conta.id; // vira data-conta-id="..." no HTML final

    card.innerHTML = `
      <h3>${conta.nome}</h3>
      <p class="valor">${formatarMoeda(conta.saldo)}</p>
      <div class="acoes-card">
        <button type="button" class="btn-icone btn-editar-conta" data-conta-id="${conta.id}">
          Editar / Adicionar saldo
        </button>
      </div>
    `;

    container.appendChild(card);
  });
}

/** Soma o saldo de todas as contas — usado no header. */
function renderSaldoTotal(contas) {
  const total = contas.reduce((soma, conta) => soma + conta.saldo, 0);
  const elemento = document.getElementById('saldo-total');
  elemento.textContent = `Saldo total: ${formatarMoeda(total)}`;
}

/**
 * Preenche QUALQUER <select> de contas passado como parâmetro.
 * Extraído como função separada porque agora temos DOIS selects desse tipo
 * (o de lançamento e o de "depositar em qual conta" do recebível) — em vez
 * de copiar a mesma lógica duas vezes, escrevemos uma vez e reaproveitamos.
 */
function preencherSelectDeContas(select, contas) {
  select.innerHTML = '';

  if (contas.length === 0) {
    select.innerHTML = '<option value="">Cadastre uma conta primeiro</option>';
    return;
  }

  contas.forEach((conta) => {
    const option = document.createElement('option');
    option.value = conta.id;
    option.textContent = conta.nome;
    select.appendChild(option);
  });
}

/**
 * Preenche o <select> do formulário de lançamento com as contas cadastradas.
 * Precisa ser chamado sempre que a lista de contas mudar.
 */
function renderSelectContas(contas) {
  const select = document.getElementById('lancamento-conta');
  preencherSelectDeContas(select, contas);
}

/**
 * Preenche o <select> "Depositar em qual conta?" do formulário de novo
 * recebível — mesma lógica do de cima, reaproveitada via preencherSelectDeContas.
 */
function renderSelectContaDestino(contas) {
  const select = document.getElementById('recebivel-conta-destino');
  preencherSelectDeContas(select, contas);
}

/* ------------------------------------------------------------
   RENDER: HISTÓRICO DE LANÇAMENTOS
   ------------------------------------------------------------ */

function renderHistorico(lancamentos, contas) {
  const lista = document.getElementById('lista-historico');
  lista.innerHTML = '';

  if (lancamentos.length === 0) {
    lista.innerHTML = '<li>Nenhum lançamento ainda.</li>';
    return;
  }

  // Mostra o mais recente primeiro. Usamos [...array] pra copiar antes de
  // ordenar, porque .sort() modifica o array original "in place" — e não
  // queremos alterar a ordem em que os dados estão salvos no storage.
  const lancamentosOrdenados = [...lancamentos].sort(
    (a, b) => new Date(b.data) - new Date(a.data)
  );

  lancamentosOrdenados.forEach((lancamento) => {
    const item = document.createElement('li');
    item.className = 'item-historico';
    item.dataset.lancamentoId = lancamento.id;

    item.innerHTML = `
      <span class="descricao">${lancamento.descricao}</span>
      <span class="valor">${formatarMoeda(lancamento.valor)}</span>
      <span class="data">${formatarData(lancamento.data)}</span>
      <button type="button" class="btn-icone btn-perigo btn-excluir-lancamento" data-lancamento-id="${lancamento.id}">
        Excluir
      </button>
    `;

    lista.appendChild(item);
  });
}

/* ------------------------------------------------------------
   RENDER: DÍVIDAS ATIVAS
   ------------------------------------------------------------ */

function renderDividas(dividas) {
  const container = document.getElementById('lista-dividas');
  container.innerHTML = '';

  if (dividas.length === 0) {
    container.innerHTML = '<p>Nenhuma dívida cadastrada.</p>';
    return;
  }

  dividas.forEach((divida) => {
    // Toda a MATEMÁTICA vem do models.js — aqui só usamos o resultado pra desenhar.
    const quitada = dividaQuitada(divida);
    const parcelasRestantes = calcularParcelasRestantes(divida);
    const valorParcela = calcularValorParcela(divida);

    const card = document.createElement('div');
    card.className = 'card-divida';
    card.dataset.dividaId = divida.id;

    if (quitada) {
      // Dívida quitada: não precisa calcular vencimento (não existe "próxima parcela")
      card.classList.add('status-ok');
      card.innerHTML = `
        <h3>${divida.descricao}</h3>
        <p>Quitada — ${divida.numParcelas} de ${divida.numParcelas} parcelas pagas</p>
        <span class="badge em-dia">Concluída</span>
        <div class="acoes-card">
          <button type="button" class="btn-icone btn-desfazer-parcela" data-divida-id="${divida.id}">
            Desfazer última parcela
          </button>
          <button type="button" class="btn-icone btn-perigo btn-excluir-divida" data-divida-id="${divida.id}">
            Excluir dívida
          </button>
        </div>
      `;
      container.appendChild(card);
      return; // pula o resto do processamento (vencimento) pra essa dívida
    }

    const diasParaVencer = calcularDiasParaVencimento(divida);
    const proximoVencimento = calcularProximoVencimento(divida);

    // Regra de alerta: vencido (negativo) ou faltando 5 dias ou menos = urgente
    const emAlerta = diasParaVencer <= 5;
    card.classList.add(emAlerta ? 'status-alerta' : 'status-ok');

    // Texto do badge muda dependendo de já ter vencido ou ainda faltar dias
    let textoBadge;
    if (diasParaVencer < 0) {
      textoBadge = `Vencida há ${Math.abs(diasParaVencer)} dia(s)`;
    } else if (diasParaVencer === 0) {
      textoBadge = 'Vence hoje';
    } else {
      textoBadge = `Vence em ${diasParaVencer} dia(s)`;
    }

    card.innerHTML = `
      <h3>${divida.descricao}</h3>
      <p>Parcela ${divida.parcelasPagas.length + 1} de ${divida.numParcelas}</p>
      <p class="valor">${formatarMoeda(valorParcela)} / parcela</p>
      <p>Restam ${parcelasRestantes} parcela(s)</p>
      <p>Previsão: ${formatarData(proximoVencimento)}</p>
      <span class="badge ${emAlerta ? 'alerta-vencimento' : 'em-dia'}">${textoBadge}</span>
      <div class="acoes-card">
        <button type="button" class="btn-icone btn-pagar-parcela" data-divida-id="${divida.id}">
          Marcar parcela como paga
        </button>
        ${
          // "Desfazer" só faz sentido mostrar se JÁ existe pelo menos 1 parcela paga —
          // não tem o que desfazer numa dívida que ainda não teve nenhum pagamento.
          divida.parcelasPagas.length > 0
            ? `<button type="button" class="btn-icone btn-desfazer-parcela" data-divida-id="${divida.id}">
                 Desfazer última parcela
               </button>`
            : ''
        }
        <button type="button" class="btn-icone btn-perigo btn-excluir-divida" data-divida-id="${divida.id}">
          Excluir dívida
        </button>
      </div>
    `;

    container.appendChild(card);
  });
}

/* ------------------------------------------------------------
   RENDER: DINHEIRO A RECEBER
   Estrutura bem parecida com renderDividas — a diferença principal
   é o texto dos botões/badges (linguagem de "receber" em vez de "pagar")
   e o fato de mostrar pra qual conta o dinheiro vai cair.
   ------------------------------------------------------------ */

function renderRecebiveis(recebiveis, contas) {
  const container = document.getElementById('lista-recebiveis');
  container.innerHTML = '';

  if (recebiveis.length === 0) {
    container.innerHTML = '<p>Nada cadastrado ainda.</p>';
    return;
  }

  recebiveis.forEach((recebivel) => {
    const quitado = dividaQuitada(recebivel); // função reaproveitada do models.js
    const parcelasRestantes = calcularParcelasRestantes(recebivel);
    const valorParcela = calcularValorParcela(recebivel);

    // Busca o nome da conta destino só pra EXIBIR — a lógica de depositar
    // o dinheiro de verdade acontece no app.js, aqui é só texto informativo.
    const contaDestino = contas.find((c) => c.id === recebivel.contaDestinoId);
    const nomeContaDestino = contaDestino ? contaDestino.nome : 'conta removida';

    const card = document.createElement('div');
    card.className = 'card-recebivel';
    card.dataset.recebivelId = recebivel.id;

    if (quitado) {
      card.innerHTML = `
        <h3>${recebivel.descricao}</h3>
        <p>Recebido por completo — ${recebivel.numParcelas} de ${recebivel.numParcelas} parcelas</p>
        <span class="badge em-dia">Concluído</span>
        <div class="acoes-card">
          <button type="button" class="btn-icone btn-excluir-recebivel" data-recebivel-id="${recebivel.id}">
            Excluir
          </button>
        </div>
      `;
      container.appendChild(card);
      return;
    }

    const proximoRecebimento = calcularProximoVencimento(recebivel);

    card.innerHTML = `
      <h3>${recebivel.descricao}</h3>
      <p>Parcela ${recebivel.parcelasPagas.length + 1} de ${recebivel.numParcelas}</p>
      <p class="valor">${formatarMoeda(valorParcela)} / parcela</p>
      <p>Restam ${parcelasRestantes} parcela(s)</p>
      <p>Previsão: ${formatarData(proximoRecebimento)}</p>
      <p>Destino: ${nomeContaDestino}</p>
      <div class="acoes-card">
        <button type="button" class="btn-icone btn-marcar-recebido" data-recebivel-id="${recebivel.id}">
          Marcar como recebido
        </button>
        <button type="button" class="btn-icone btn-perigo btn-excluir-recebivel" data-recebivel-id="${recebivel.id}">
          Excluir
        </button>
      </div>
    `;

    container.appendChild(card);
  });
}