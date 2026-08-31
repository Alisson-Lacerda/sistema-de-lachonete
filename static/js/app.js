// ============================================================
// CARRINHO GLOBAL
// ============================================================
let cart = [];

// ============================================================
// CONTROLE DE QUANTIDADE (+ e -)
// ============================================================

function updateQty(btn, delta) {
    // Pega o container de quantidade
    const control = btn.closest('.qty-control');

    // Pega os dados do item
    const name = control.dataset.name;
    const price = parseFloat(control.dataset.price);

    // Pega o span que mostra a quantidade
    const spanQtd = control.querySelector('.qty-value');
    let qtd = parseInt(spanQtd.innerText);

    // Calcula nova quantidade
    qtd += delta;
    if (qtd < 0) qtd = 0;

    // Atualiza o número na tela
    spanQtd.innerText = qtd;

    // Pega o card pai para destacar
    const card = control.closest('.menu-item');
    if (qtd > 0) {
        card.classList.add('in-cart');
    } else {
        card.classList.remove('in-cart');
    }

    // Atualiza o carrinho global
    updateCartItem(name, price, qtd);

    // Atualiza a visualização do pedido
    renderCart();

    // Mostra toast
    if (delta > 0 && qtd > 0) {
        showToast(name + ' adicionado!');
    } else if (delta < 0 && qtd === 0) {
        showToast(name + ' removido do carrinho.');
    }
}

function updateCartItem(name, price, quantity) {
    // Procura se o item já existe no carrinho
    const index = cart.findIndex(item => item.name === name);

    if (quantity === 0) {
        // Remove do carrinho se quantidade for zero
        if (index > -1) {
            cart.splice(index, 1);
        }
    } else if (index > -1) {
        // Atualiza quantidade existente
        cart[index].quantity = quantity;
    } else {
        // Adiciona novo item
        cart.push({
            name: name,
            price: price,
            quantity: quantity
        });
    }
}

function renderCart() {
    const cartItemsDiv = document.getElementById('cartItems');
    const cartTotalDiv = document.getElementById('cartTotal');
    const totalValueSpan = document.getElementById('totalValue');

    if (cart.length === 0) {
        cartItemsDiv.innerHTML = '<p style="color: var(--gray); text-align: center;">Nenhum item adicionado ainda. Escolha do cardápio acima.</p>';
        cartTotalDiv.style.display = 'none';
        return;
    }

    // Monta a lista de itens
    let html = '';
    let total = 0;

    cart.forEach(item => {
        const subtotal = item.price * item.quantity;
        total += subtotal;
        html += `
            <div class="cart-item" style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee;">
                <span><strong>${item.name}</strong> x${item.quantity}</span>
                <span>R$ ${subtotal.toFixed(2).replace('.', ',')}</span>
            </div>
        `;
    });

    cartItemsDiv.innerHTML = html;
    cartTotalDiv.style.display = 'flex';
    totalValueSpan.innerText = 'R$ ' + total.toFixed(2).replace('.', ',');
}

// ============================================================
// TOAST NOTIFICATION
// ============================================================

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
        showToast('Adicione pelo menos um item ao carrinho!');
        return;
    }

    // Monta os dados no formato que o Flask espera
    const data = {
        nome: document.getElementById('nome').value,
        telefone: document.getElementById('telefone').value,
        endereco: document.getElementById('endereco').value,
        pagamento: document.getElementById('pagamento').value,
        troco: document.getElementById('troco').value,
        observacoes: document.getElementById('observacoes').value,
        itens: cart.map(item => ({
            name: item.name,
            price: item.price,
            quantity: item.quantity
        })),
        total: cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)
    };

    // Desabilita o botão para evitar cliques duplos
    const btnSubmit = this.querySelector('button[type="submit"]');
    const btnOriginalText = btnSubmit.innerHTML;
    btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
    btnSubmit.disabled = true;

    try {
        const response = await fetch('/api/pedidos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (response.ok && result.success) {
            showToast('Pedido #' + result.pedido_id + ' enviado com sucesso!');
            // Limpa o carrinho
            cart = [];
            document.querySelectorAll('.qty-value').forEach(span => span.innerText = '0');
            document.querySelectorAll('.menu-item').forEach(card => card.classList.remove('in-cart'));
            renderCart();
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

// ============================================================
// SCROLL SUAVE
// ============================================================

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        e.preventDefault();
        document.querySelector(this.getAttribute('href')).scrollIntoView({
            behavior: 'smooth'
        });
    });
});