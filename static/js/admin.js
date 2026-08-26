// Configurações
const REFRESH_INTERVAL = 10000; // 10 segundos

// Guarda o último ID de pedido visto (para detectar novos)
let ultimoIdVisto = 0;
let somAtivado = true;

// Carrega os pedidos ao abrir a página
document.addEventListener('DOMContentLoaded', () => {
    carregarPedidos();
    setInterval(carregarPedidos, REFRESH_INTERVAL);
    criarBotaoSom();
});

/**
 * Toca um som de notificação usando Web Audio API.
 * Não precisa de arquivo de áudio — gera o som programaticamente.
 */
function tocarSomNotificacao() {
    if (!somAtivado) return;

    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioContext();

        // Primeiro tom (mais agudo)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(880, ctx.currentTime); // Lá5
        gain1.gain.setValueAtTime(0.3, ctx.currentTime);
        gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(ctx.currentTime);
        osc1.stop(ctx.currentTime + 0.3);

        // Segundo tom (um pouco mais grave, meio segundo depois)
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(698, ctx.currentTime + 0.15); // Fá5
        gain2.gain.setValueAtTime(0.3, ctx.currentTime + 0.15);
        gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.45);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(ctx.currentTime + 0.15);
        osc2.stop(ctx.currentTime + 0.45);

    } catch (e) {
        console.log('Audio não suportado neste navegador');
    }
}

/**
 * Cria o botão de ligar/desligar som no navbar.
 */
function criarBotaoSom() {
    const actionsDiv = document.querySelector('.admin-actions');
    if (!actionsDiv) return;

    const btnSom = document.createElement('button');
    btnSom.id = 'btnSom';
    btnSom.className = 'btn-som';
    btnSom.innerHTML = '<i class="fas fa-volume-up"></i>';
    btnSom.title = 'Clique para desativar o som';
    btnSom.onclick = () => {
        somAtivado = !somAtivado;
        btnSom.innerHTML = somAtivado
            ? '<i class="fas fa-volume-up"></i>'
            : '<i class="fas fa-volume-mute"></i>';
        btnSom.title = somAtivado ? 'Clique para desativar o som' : 'Clique para ativar o som';
        showToast(somAtivado ? 'Som ativado 🔊' : 'Som desativado 🔇');
    };

    // Insere antes do botão de logout
    const logoutBtn = actionsDiv.querySelector('.btn-logout');
    if (logoutBtn) {
        actionsDiv.insertBefore(btnSom, logoutBtn);
    } else {
        actionsDiv.appendChild(btnSom);
    }
}

/**
 * Busca os pedidos do backend e renderiza na tabela.
 */
async function carregarPedidos() {
    try {
        const response = await fetch('/api/pedidos');
        const data = await response.json();

        if (data.success) {
            detectarPedidoNovo(data.pedidos);
            renderizarPedidos(data.pedidos);
            atualizarEstatisticas(data.pedidos);
            atualizarHorario();
        } else {
            showToast('Erro ao carregar pedidos.');
        }
    } catch (error) {
        console.error('Erro:', error);
        showToast('Erro de conexão com o servidor.');
    }
}

/**
 * Detecta se chegou pedido novo e toca som.
 */
function detectarPedidoNovo(pedidos) {
    if (pedidos.length === 0) return;

    // Pega o maior ID da lista atual
    const maiorIdAtual = Math.max(...pedidos.map(p => p.id));

    // Se é a primeira vez carregando, só registra o ID
    if (ultimoIdVisto === 0) {
        ultimoIdVisto = maiorIdAtual;
        return;
    }

    // Se tem pedido novo
    if (maiorIdAtual > ultimoIdVisto) {
        const qtdNovos = pedidos.filter(p => p.id > ultimoIdVisto && p.status === 'pendente').length;

        if (qtdNovos > 0) {
            tocarSomNotificacao();
            showToast(`🛎️ ${qtdNovos} pedido(s) novo(s) recebido(s)!`);
        }

        ultimoIdVisto = maiorIdAtual;
    }
}

/**
 * Renderiza os pedidos na tabela HTML.
 */
function renderizarPedidos(pedidos) {
    const tbody = document.getElementById('pedidosTbody');

    if (pedidos.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <p>Nenhum pedido encontrado.</p>
                </td>
            </tr>
        `;
        return;
    }

    let html = '';
    pedidos.forEach(p => {
        const itens = p.itens ? p.itens.map(i => i.nome_item || i.name).join(', ') : '-';
        const statusClass = 'status-' + (p.status || 'pendente');
        const statusLabel = formatarStatus(p.status);

        html += `
            <tr>
                <td><strong>#${p.id}</strong></td>
                <td>${formatarData(p.data_hora)}</td>
                <td>${p.nome}</td>
                <td>${p.telefone}</td>
                <td>${p.endereco}</td>
                <td class="itens-list">${itens}</td>
                <td><strong>R$ ${parseFloat(p.total).toFixed(2).replace('.', ',')}</strong></td>
                <td>${formatarPagamento(p.pagamento)}</td>
                <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
                <td>
                    ${botoesAcao(p.id, p.status)}
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

/**
 * Retorna os botões de ação conforme o status atual.
 */
function botoesAcao(id, status) {
    let botoes = '';

    if (status === 'pendente') {
        botoes += `<button class="btn-action btn-preparo" onclick="atualizarStatus(${id}, 'em_preparo')">Em Preparo</button>`;
        botoes += `<button class="btn-action btn-cancelar" onclick="atualizarStatus(${id}, 'cancelado')">Cancelar</button>`;
    } else if (status === 'em_preparo') {
        botoes += `<button class="btn-action btn-pronto" onclick="atualizarStatus(${id}, 'pronto')">Pronto</button>`;
        botoes += `<button class="btn-action btn-cancelar" onclick="atualizarStatus(${id}, 'cancelado')">Cancelar</button>`;
    } else if (status === 'pronto') {
        botoes += `<button class="btn-action btn-entregue" onclick="atualizarStatus(${id}, 'entregue')">Entregue</button>`;
    }

    return botoes;
}

/**
 * Atualiza o status de um pedido.
 */
async function atualizarStatus(id, novoStatus) {
    try {
        const response = await fetch(`/api/pedidos/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: novoStatus })
        });

        const data = await response.json();

        if (data.success) {
            showToast(`Pedido #${id} → ${formatarStatus(novoStatus)}`);
            carregarPedidos();
        } else {
            showToast(data.message || 'Erro ao atualizar.');
        }
    } catch (error) {
        console.error('Erro:', error);
        showToast('Erro de conexão.');
    }
}

/**
 * Atualiza os cards de estatísticas.
 */
function atualizarEstatisticas(pedidos) {
    const contar = (status) => pedidos.filter(p => p.status === status).length;

    document.getElementById('statPendente').textContent = contar('pendente');
    document.getElementById('statPreparo').textContent = contar('em_preparo');
    document.getElementById('statPronto').textContent = contar('pronto');
    document.getElementById('statEntregue').textContent = contar('entregue');
}

/**
 * Atualiza o horário da última atualização.
 */
function atualizarHorario() {
    const agora = new Date();
    const hora = agora.toLocaleTimeString('pt-BR');
    document.getElementById('lastUpdate').textContent = `Atualizado: ${hora}`;
}

/* ========== UTILITÁRIOS ========== */

function formatarStatus(status) {
    const map = {
        'pendente': 'Pendente',
        'em_preparo': 'Em Preparo',
        'pronto': 'Pronto',
        'entregue': 'Entregue',
        'cancelado': 'Cancelado'
    };
    return map[status] || status;
}

function formatarPagamento(pag) {
    const map = {
        'dinheiro': 'Dinheiro',
        'cartao': 'Cartão',
        'pix': 'PIX'
    };
    return map[pag] || pag;
}

function formatarData(dataStr) {
    if (!dataStr) return '-';
    const data = new Date(dataStr);
    return data.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function showToast(message) {
    let toast = document.getElementById('adminToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'adminToast';
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, 3000);
}
