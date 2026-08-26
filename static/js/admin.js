// Configurações
const REFRESH_INTERVAL = 10000; // 10 segundos

// Carrega os pedidos ao abrir a página
document.addEventListener('DOMContentLoaded', () => {
    carregarPedidos();
    // Atualiza automaticamente a cada 10 segundos
    setInterval(carregarPedidos, REFRESH_INTERVAL);
});

/**
 * Busca os pedidos do backend e renderiza na tabela.
 */
async function carregarPedidos() {
    try {
        const response = await fetch('/api/pedidos');
        const data = await response.json();

        if (data.success) {
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
            carregarPedidos(); // Recarrega a lista
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
