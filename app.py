from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from flask_cors import CORS
from functools import wraps
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor

app = Flask(__name__)
CORS(app)

# ============================================================
# CONFIGURAÇÃO DE SEGURANÇA — MUDE AQUI!
# ============================================================
ADMIN_USERNAME = 'admin'
ADMIN_PASSWORD = '123456'  # <-- MUDE ISSO! O dono escolhe essa senha

# Chave secreta para criptografar as sessões (mude para algo aleatório)
app.secret_key = 'SenhaSecreta123456'

# ============================================================
# CONFIGURAÇÃO DO BANCO DE DADOS (PostgreSQL) — MUDE AQUI!
# ============================================================
DB_CONFIG = {
    'dbname': 'pedidos_db',
    'user': 'postgres',
    'password': '1234',  # <-- SENHA DO SEU POSTGRESQL
    'host': 'localhost',
    'port': '5432'
}

def get_db_connection():
    return psycopg2.connect(**DB_CONFIG)


# ============================================================
# DECORATOR DE AUTENTICAÇÃO
# ============================================================

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'logged_in' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function


# ============================================================
# ROTAS DO FRONTEND
# ============================================================

@app.route('/')
def index():
    """Landing page para os clientes fazerem pedidos."""
    return render_template('index.html')


@app.route('/admin/login', methods=['GET', 'POST'])
def login():
    """
    Página de login do admin.
    GET: mostra o formulário
    POST: verifica usuário/senha
    """
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')

        if username == ADMIN_USERNAME and password == ADMIN_PASSWORD:
            session['logged_in'] = True
            return redirect(url_for('admin'))
        else:
            return render_template('login.html', erro='Usuário ou senha incorretos.')

    return render_template('login.html')


@app.route('/admin/logout')
def logout():
    """Desloga o usuário."""
    session.pop('logged_in', None)
    return redirect(url_for('login'))


@app.route('/admin')
@login_required
def admin():
    """Painel administrativo — só entra se estiver logado."""
    return render_template('admin.html')


# ============================================================
# API — RECEBER PEDIDO
# ============================================================

@app.route('/api/pedidos', methods=['POST'])
def criar_pedido():
    """
    Recebe o pedido do cliente e salva no PostgreSQL.
    """
    data = request.get_json()

    # Validação
    campos_obrigatorios = ['nome', 'telefone', 'endereco', 'pagamento', 'itens']
    for campo in campos_obrigatorios:
        if not data.get(campo):
            return jsonify({"success": False, "message": f"O campo '{campo}' é obrigatório."}), 400

    if len(data.get('itens', [])) == 0:
        return jsonify({"success": False, "message": "O carrinho está vazio."}), 400

    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # 1. Insere o pedido
        cur.execute("""
            INSERT INTO pedidos (nome, telefone, endereco, pagamento, troco, observacoes, total)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (
            data['nome'],
            data['telefone'],
            data['endereco'],
            data['pagamento'],
            data.get('troco', ''),
            data.get('observacoes', ''),
            data.get('total', 0)
        ))

        pedido_id = cur.fetchone()[0]

        # 2. Insere os itens do pedido
        for item in data['itens']:
            cur.execute("""
                INSERT INTO itens_pedido (pedido_id, nome_item, preco, quantidade)
                VALUES (%s, %s, %s, %s)
            """, (pedido_id, item['name'], item['price'], 1))

        conn.commit()
        cur.close()
        conn.close()

        print(f"\n✅ NOVO PEDIDO #{pedido_id} — {data['nome']} — R$ {data['total']:.2f}")

        return jsonify({
            "success": True,
            "message": "Pedido recebido com sucesso!",
            "pedido_id": pedido_id
        }), 201

    except Exception as e:
        print(f"❌ ERRO ao salvar pedido: {e}")
        return jsonify({"success": False, "message": "Erro interno no servidor."}), 500


# ============================================================
# API — LISTAR PEDIDOS (para o painel admin)
# ============================================================

@app.route('/api/pedidos', methods=['GET'])
def listar_pedidos():
    """
    Retorna todos os pedidos com seus itens.
    """
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        # Busca os pedidos
        cur.execute("SELECT * FROM pedidos ORDER BY data_hora DESC")
        pedidos = cur.fetchall()

        # Para cada pedido, busca os itens
        for pedido in pedidos:
            cur.execute("""
                SELECT nome_item, preco, quantidade
                FROM itens_pedido
                WHERE pedido_id = %s
            """, (pedido['id'],))
            pedido['itens'] = cur.fetchall()

        cur.close()
        conn.close()

        return jsonify({"success": True, "pedidos": pedidos})

    except Exception as e:
        print(f"❌ ERRO ao listar pedidos: {e}")
        return jsonify({"success": False, "message": str(e)}), 500


# ============================================================
# API — ATUALIZAR STATUS DO PEDIDO
# ============================================================

@app.route('/api/pedidos/<int:pedido_id>/status', methods=['PUT'])
def atualizar_status(pedido_id):
    """
    Atualiza o status de um pedido (pendente → em_preparo → pronto → entregue).
    """
    data = request.get_json()
    novo_status = data.get('status')

    status_permitidos = ['pendente', 'em_preparo', 'pronto', 'entregue', 'cancelado']
    if novo_status not in status_permitidos:
        return jsonify({"success": False, "message": "Status inválido."}), 400

    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("UPDATE pedidos SET status = %s WHERE id = %s", (novo_status, pedido_id))
        conn.commit()
        cur.close()
        conn.close()

        print(f"🔄 Pedido #{pedido_id} → {novo_status}")

        return jsonify({
            "success": True,
            "message": f"Pedido #{pedido_id} atualizado para '{novo_status}'"
        })

    except Exception as e:
        print(f"❌ ERRO ao atualizar status: {e}")
        return jsonify({"success": False, "message": str(e)}), 500


# ============================================================
# EXECUÇÃO
# ============================================================

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
