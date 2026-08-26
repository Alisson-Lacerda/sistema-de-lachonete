// Carrinho de pedidos
let cart = [];

/**
 * Adiciona um item ao carrinho.
 */
function addItem(name, price) {
    cart.push({ name, price });
    updateCart();
    showToast(name + ' adicionado!');
}

/**
 * Atualiza a visualização do carrinho.
 */
function updateCart() {
    const cartItemsDiv = document.getElementById('cartItems');
    const cartTotalDiv = document.getElementById('cartTotal');
    const totalValueSpan = document.getElementById('totalValue');

    if (cart.length === 0) {
        cartItemsDiv.innerHTML = '<p style="color: var(--gray); text-align: center;">Nenhum item adicionado ainda. Escolha do cardápio acima.</p>';
        cartTotalDiv.style.display = 'none';
        return;
    }

    let html = '';
    let total = 0;
    cart.forEach((item) => {
        total += item.price;
        html += `<div class="cart-item">
            <span>${item.name}</span>
            <span>R$ ${item.price.toFixed(2).replace('.', ',')}</span>
        </div>`;
    });

    cartItemsDiv.innerHTML = html;
    totalValueSpan.textContent = 'R$ ' + total.toFixed(2).replace('.', ',');
    cartTotalDiv.style.display = 'flex';
}

/**
 * Mostra notificação na tela.
 */
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.style.display = 'block';
    setTimeout(() => {
        toast.style.display = 'none';
    }, 2500);
}

// ============================================================
// ENVIO DO PEDIDO PARA O BACKEND
// ============================================================

document.getElementById('orderForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    if (cart.length === 0) {
        showToast('Adicione itens ao pedido primeiro!');
        return;
    }

    // Pega os dados do formulário
    const formData = new FormData(this);
    const data = {
        nome: formData.get('nome'),
        telefone: formData.get('telefone'),
        endereco: formData.get('endereco'),
        pagamento: formData.get('pagamento'),
        troco: formData.get('troco'),
        observacoes: formData.get('observacoes'),
        itens: cart,
        total: cart.reduce((sum, item) => sum + item.price, 0)
    };

    // Desabilita o botão para evitar cliques duplos
    const btnSubmit = this.querySelector('button[type="submit"]');
    const btnOriginalText = btnSubmit.innerHTML;
    btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
    btnSubmit.disabled = true;

    try {
        // ENVIA PARA O BACKEND FLASK
        const response = await fetch('/api/pedidos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (response.ok && result.success) {
            showToast('Pedido #' + result.pedido_id + ' enviado com sucesso!');
            cart = [];
            updateCart();
            this.reset();
        } else {
            showToast(result.message || 'Erro ao enviar pedido.');
        }

    } catch (error) {
        console.error('Erro:', error);
        showToast('Erro de conexão. Verifique se o servidor está rodando.');
    } finally {
        // Reabilita o botão
        btnSubmit.innerHTML = btnOriginalText;
        btnSubmit.disabled = false;
    }
});

// Scroll suave
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        e.preventDefault();
        document.querySelector(this.getAttribute('href')).scrollIntoView({
            behavior: 'smooth'
        });
    });
});
