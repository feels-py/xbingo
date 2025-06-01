from flask import Flask, render_template, request, jsonify, redirect, url_for
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timedelta
import random
import os
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///bingo.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['UPLOAD_FOLDER'] = 'static/images/sponsors'
app.config['ALLOWED_EXTENSIONS'] = {'png', 'jpg', 'jpeg', 'gif'}

db = SQLAlchemy(app)

# Modelos
class Card(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    card_id = db.Column(db.String(50), unique=True, nullable=False)
    name = db.Column(db.String(100), nullable=False)
    numbers = db.Column(db.String(255), nullable=False)  # Armazenar como string separada por vírgulas
    is_winner = db.Column(db.Boolean, default=False)

class Settings(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    countdown_time = db.Column(db.DateTime)
    sponsor_images = db.Column(db.String(500))  # Armazenar como string separada por vírgulas
    prize_image = db.Column(db.String(100))
    drawn_numbers = db.Column(db.String(500))  # Armazenar como string separada por vírgulas
    is_drawing = db.Column(db.Boolean, default=False)
    has_winner = db.Column(db.Boolean, default=False)

# Criar banco de dados
with app.app_context():
    db.create_all()

# Funções auxiliares
def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']

# Rotas
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/admin')
def admin():
    return render_template('admin.html')

# API
@app.route('/api/cards', methods=['GET', 'POST'])
def cards():
    if request.method == 'GET':
        cards = Card.query.all()
        return jsonify([{
            'id': card.id,
            'card_id': card.card_id,
            'name': card.name,
            'numbers': [int(n) for n in card.numbers.split(',')],
            'is_winner': card.is_winner
        } for card in cards])
    
    elif request.method == 'POST':
        data = request.json
        new_card = Card(
            card_id=data['card_id'],
            name=data['name'],
            numbers=','.join(map(str, data['numbers'])))
        db.session.add(new_card)
        db.session.commit()
        return jsonify({'message': 'Cartela adicionada com sucesso!'}), 201

@app.route('/api/settings', methods=['GET', 'POST'])
def settings():
    if request.method == 'GET':
        settings = Settings.query.first()
        if not settings:
            return jsonify({})
        
        return jsonify({
            'countdown_time': settings.countdown_time.isoformat() if settings.countdown_time else None,
            'sponsor_images': settings.sponsor_images.split(',') if settings.sponsor_images else [],
            'prize_image': settings.prize_image,
            'drawn_numbers': [int(n) for n in settings.drawn_numbers.split(',')] if settings.drawn_numbers else [],
            'is_drawing': settings.is_drawing,
            'has_winner': settings.has_winner
        })
    
    elif request.method == 'POST':
        data = request.json
        settings = Settings.query.first()
        
        if not settings:
            settings = Settings()
            db.session.add(settings)
        
        if 'countdown_time' in data:
            settings.countdown_time = datetime.fromisoformat(data['countdown_time']) if data['countdown_time'] else None
        
        if 'sponsor_images' in data:
            settings.sponsor_images = ','.join(data['sponsor_images'])
        
        if 'prize_image' in data:
            settings.prize_image = data['prize_image']
        
        if 'drawn_numbers' in data:
            settings.drawn_numbers = ','.join(map(str, data['drawn_numbers']))
        
        if 'is_drawing' in data:
            settings.is_drawing = data['is_drawing']
        
        if 'has_winner' in data:
            settings.has_winner = data['has_winner']
        
        db.session.commit()
        return jsonify({'message': 'Configurações atualizadas!'})

@app.route('/api/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'Nenhum arquivo enviado'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'Nenhum arquivo selecionado'}), 400
    
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
        return jsonify({'filename': filename})
    
    return jsonify({'error': 'Tipo de arquivo não permitido'}), 400

@app.route('/api/start_drawing', methods=['POST'])
def start_drawing():
    settings = Settings.query.first()
    if not settings:
        settings = Settings()
        db.session.add(settings)
    
    settings.is_drawing = True
    settings.has_winner = False
    settings.drawn_numbers = ''
    db.session.commit()
    
    # Resetar cartelas vencedoras
    Card.query.update({'is_winner': False})
    db.session.commit()
    
    return jsonify({'message': 'Sorteio iniciado!'})

@app.route('/api/draw_number', methods=['POST'])
def draw_number():
    settings = Settings.query.first()
    if not settings or not settings.is_drawing:
        return jsonify({'error': 'Sorteio não iniciado'}), 400
    
    # Gerar número aleatório que ainda não foi sorteado
    drawn_numbers = [int(n) for n in settings.drawn_numbers.split(',')] if settings.drawn_numbers else []
    available_numbers = [n for n in range(1, 76) if n not in drawn_numbers]
    
    if not available_numbers:
        settings.is_drawing = False
        db.session.commit()
        return jsonify({'error': 'Todos os números já foram sorteados'}), 400
    
    new_number = random.choice(available_numbers)
    drawn_numbers.append(new_number)
    settings.drawn_numbers = ','.join(map(str, drawn_numbers))
    
    # Verificar se alguma cartela ganhou
    cards = Card.query.all()
    for card in cards:
        card_numbers = [int(n) for n in card.numbers.split(',')]
        if all(n in drawn_numbers for n in card_numbers):
            card.is_winner = True
            settings.has_winner = True
            settings.is_drawing = False
            db.session.commit()
            return jsonify({
                'number': new_number,
                'has_winner': True,
                'winner': {
                    'card_id': card.card_id,
                    'name': card.name,
                    'numbers': card_numbers
                }
            })
    
    db.session.commit()
    return jsonify({'number': new_number, 'has_winner': False})

# Configurações para produção
if __name__ != '__main__':
    gunicorn_logger = logging.getLogger('gunicorn.error')
    app.logger.handlers = gunicorn_logger.handlers
    app.logger.setLevel(gunicorn_logger.level)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))