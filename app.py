from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor

app = Flask(__name__)
CORS(app)

# ============================================================
# CONFIGURAÇÃO DO BANCO DE DADOS
# ============================================================
# ⚠️ EDITE AQUI COM SEUS DADOS DO POSTGRESQL
DB_CONFIG = {
    'dbname': 'pedidos_db',
    'user': 'postgres',      # ou seu usuário
    'password': '1234', # sua senha do PostgreSQL
    'host': 'localhost',
    'port': '5432'
}

def get_db_connection():
    return psycopg2.connect(**DB_CONFIG)


# ============================================================
# ROTAS DO FRONTEND
# ============================================================

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/admin')
def admin():
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT * FROM pedidos ORDER BY data_hora DESC")
    pedidos = cur.fetchall()
    cur.close()
    conn.close()
    return jsonify({"pedidos": pedidos})


# ============================================================
# API — RECEBER PEDIDO
# ============================================================

@app.route('/api/pedidos', methods=['POST'])
def criar_pedido():
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

        print(f"\n✅ NOVO PEDIDO #{pedido_id}")
        print(f"   Cliente: {data['nome']}")
        print(f"   Total: R$ {data['total']:.2f}")

        return jsonify({
            "success": True,
            "message": "Pedido recebido com sucesso!",
            "pedido_id": pedido_id
        }), 201

    except Exception as e:
        print(f"❌ ERRO ao salvar pedido: {e}")
        return jsonify({"success": False, "message": "Erro interno no servidor."}), 500


@app.route('/api/pedidos', methods=['GET'])
def listar_pedidos():
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT * FROM pedidos ORDER BY data_hora DESC")
        pedidos = cur.fetchall()
        cur.close()
        conn.close()
        return jsonify({"success": True, "pedidos": pedidos})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@app.route('/api/pedidos/<int:pedido_id>/status', methods=['PUT'])
def atualizar_status(pedido_id):
    data = request.get_json()
    novo_status = data.get('status')

    if novo_status not in ['pendente', 'em_preparo', 'pronto', 'entregue', 'cancelado']:
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


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)