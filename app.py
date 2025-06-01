from flask import Flask, render_template, request, jsonify
from flask_sqlalchemy import SQLAlchemy
import os
import random
from datetime import datetime

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///bingo.db').replace('postgres://', 'postgresql://')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['UPLOAD_FOLDER'] = 'static/images/sponsors'

db = SQLAlchemy(app)

class Card(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    card_id = db.Column(db.String(50), unique=True, nullable=False)
    name = db.Column(db.String(100), nullable=False)
    numbers = db.Column(db.String(255), nullable=False)  # Números separados por vírgula
    is_winner = db.Column(db.Boolean, default=False)

class Settings(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    countdown_time = db.Column(db.DateTime)
    sponsor_images = db.Column(db.String(500))  # Caminhos separados por vírgula
    prize_image = db.Column(db.String(100))
    drawn_numbers = db.Column(db.String(500))  # Números separados por vírgula
    is_drawing = db.Column(db.Boolean, default=False)
    has_winner = db.Column(db.Boolean, default=False)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/admin')
def admin():
    return render_template('admin.html')

@app.route('/api/cards', methods=['GET', 'POST'])
def handle_cards():
    if request.method == 'GET':
        cards = Card.query.all()
        return jsonify([{
            'id': card.id,
            'card_id': card.card_id,
            'name': card.name,
            'numbers': [int(n) for n in card.numbers.split(',')],
            'is_winner': card.is_winner
        } for card in cards])
    
    if request.method == 'POST':
        data = request.get_json()
        new_card = Card(
            card_id=data['card_id'],
            name=data['name'],
            numbers=','.join(map(str, data['numbers']))
        )
        db.session.add(new_card)
        db.session.commit()
        return jsonify({'success': True}), 201

@app.route('/api/settings', methods=['GET', 'POST'])
def handle_settings():
    settings = Settings.query.first() or Settings()
    
    if request.method == 'GET':
        return jsonify({
            'countdown_time': settings.countdown_time.isoformat() if settings.countdown_time else None,
            'sponsor_images': settings.sponsor_images.split(',') if settings.sponsor_images else [],
            'prize_image': settings.prize_image,
            'drawn_numbers': [int(n) for n in settings.drawn_numbers.split(',')] if settings.drawn_numbers else [],
            'is_drawing': settings.is_drawing,
            'has_winner': settings.has_winner
        })
    
    if request.method == 'POST':
        data = request.get_json()
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
        
        db.session.add(settings)
        db.session.commit()
        return jsonify({'success': True})

@app.route('/api/draw', methods=['POST'])
def draw_number():
    settings = Settings.query.first() or Settings()
    if not settings.is_drawing:
        return jsonify({'error': 'Sorteio não iniciado'}), 400
    
    drawn_numbers = [int(n) for n in settings.drawn_numbers.split(',')] if settings.drawn_numbers else []
    available_numbers = [n for n in range(1, 76) if n not in drawn_numbers]
    
    if not available_numbers:
        return jsonify({'error': 'Todos os números foram sorteados'}), 400
    
    new_number = random.choice(available_numbers)
    drawn_numbers.append(new_number)
    settings.drawn_numbers = ','.join(map(str, drawn_numbers))
    
    # Verificar vencedores
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

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))