import os
from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from flask_cors import CORS
from functools import wraps
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

# Carrega variáveis do arquivo .env (em desenvolvimento)
load_dotenv()

app = Flask(__name__)
CORS(app)

# ============================================================
# CONFIGURAÇÃO DE SEGURANÇA — via variáveis de ambiente
# ============================================================
ADMIN_USERNAME = 'admin'
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'admin123')
app.secret_key = os.environ.get('SECRET_KEY', 'chave-padrao-mude-isso')

# ============================================================
# CONFIGURAÇÃO DO BANCO DE DADOS — via variáveis de ambiente
# ============================================================
DB_CONFIG = {
    'dbname': os.environ.get('DB_NAME', 'pedidos_db'),
    'user': os.environ.get('DB_USER', 'postgres'),
    'password': os.environ.get('DB_PASSWORD', ''),
    'host': os.environ.get('DB_HOST', 'localhost'),
    'port': os.environ.get('DB_PORT', '5432')
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
    return render_template('index.html')


@app.route('/admin/login', methods=['GET', 'POST'])
def login():
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
    session.pop('logged_in', None)
    return redirect(url_for('login'))


@app.route('/admin')
@login_required
def admin():
    return render_template('admin.html')


# ============================================================
# API — RECEBER PEDIDO
# ============================================================

@app.route('/api/pedidos', methods=['POST'])
def criar_pedido():
    data = request.get_json()

    campos_obrigatorios = ['nome', 'telefone', 'endereco', 'pagamento', 'itens']
    for campo in campos_obrigatorios:
        if not data.get(campo):
            return jsonify({"success": False, "message": f"O campo '{campo}' é obrigatório."}), 400

    if len(data.get('itens', [])) == 0:
        return jsonify({"success": False, "message": "O carrinho está vazio."}), 400

    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("""
            INSERT INTO pedidos (nome, telefone, endereco, pagamento, troco, observacoes, total)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (
            data['nome'], data['telefone'], data['endereco'],
            data['pagamento'], data.get('troco', ''),
            data.get('observacoes', ''), data.get('total', 0)
        ))

        pedido_id = cur.fetchone()[0]

        for item in data['itens']:
            cur.execute("""
                INSERT INTO itens_pedido (pedido_id, nome_item, preco, quantidade)
                VALUES (%s, %s, %s, %s)
            """, (pedido_id, item['name'], item['price'], 1))

        conn.commit()
        cur.close()
        conn.close()

        return jsonify({
            "success": True,
            "message": "Pedido recebido com sucesso!",
            "pedido_id": pedido_id
        }), 201

    except Exception as e:
        print(f"ERRO ao salvar pedido: {e}")
        return jsonify({"success": False, "message": "Erro interno no servidor."}), 500


# ============================================================
# API — LISTAR PEDIDOS
# ============================================================

@app.route('/api/pedidos', methods=['GET'])
def listar_pedidos():
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        cur.execute("SELECT * FROM pedidos ORDER BY data_hora DESC")
        pedidos = cur.fetchall()

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
        return jsonify({"success": False, "message": str(e)}), 500


# ============================================================
# API — ATUALIZAR STATUS
# ============================================================

@app.route('/api/pedidos/<int:pedido_id>/status', methods=['PUT'])
def atualizar_status(pedido_id):
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

        return jsonify({
            "success": True,
            "message": f"Pedido #{pedido_id} atualizado para '{novo_status}'"
        })

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


# ============================================================
# EXECUÇÃO
# ============================================================

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
