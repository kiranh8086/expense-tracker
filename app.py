"""
SplitTrip - Expense Tracker
Flask backend with SQLite database
"""

import os
import json
from datetime import datetime
from flask import Flask, render_template, request, jsonify, session
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash

# Initialize Flask app
app = Flask(__name__)

# Database configuration
basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'splittrip_v2.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = 'splittrip-secret-key-change-in-production'

db = SQLAlchemy(app)

# ===================================
# Database Models
# ===================================

class Trip(db.Model):
    """Trip model - stores trip information"""
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    currency = db.Column(db.String(10), default='₹')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship with expenses
    expenses = db.relationship('Expense', backref='trip', lazy=True, cascade='all, delete-orphan')
    participants = db.relationship('Participant', backref='trip', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self, include_members=False, current_phone=None):
        members_data = []
        if include_members:
            members_data = [
                {
                    'name': p.name,
                    'phone': p.phone,
                    'is_admin': p.is_admin
                }
                for p in self.participants
            ]
        is_admin = False
        if current_phone:
            is_admin = any(p.phone == current_phone and p.is_admin for p in self.participants)
        return {
            'id': self.id,
            'name': self.name,
            'currency': self.currency,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'expense_count': len(self.expenses),
            'total_amount': sum(e.amount for e in self.expenses),
            'members': members_data,
            'current_user_is_admin': is_admin
        }

class Participant(db.Model):
    """Participant model - stores member info per trip"""
    id = db.Column(db.Integer, primary_key=True)
    trip_id = db.Column(db.Integer, db.ForeignKey('trip.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    phone = db.Column(db.String(20), nullable=False)
    pin_hash = db.Column(db.String(255), nullable=False)
    is_admin = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class Expense(db.Model):
    """Expense model - stores individual expenses"""
    id = db.Column(db.Integer, primary_key=True)
    trip_id = db.Column(db.Integer, db.ForeignKey('trip.id'), nullable=False)
    description = db.Column(db.String(200), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    category = db.Column(db.String(30), nullable=False, default='Miscellaneous')
    paid_by = db.Column(db.String(100), nullable=False)
    split_between = db.Column(db.Text, nullable=False)  # JSON array of member names
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'trip_id': self.trip_id,
            'description': self.description,
            'amount': self.amount,
            'category': self.category,
            'paid_by': self.paid_by,
            'split_between': json.loads(self.split_between),
            'created_at': self.created_at.isoformat(),
            'timestamp': int(self.created_at.timestamp() * 1000)
        }


EXPENSE_CATEGORIES = {'Travel', 'Food', 'Activity', 'Miscellaneous'}


# ===================================
# Create database tables
# ===================================

with app.app_context():
    db.create_all()


# ===================================
# Routes - Pages
# ===================================

@app.route('/')
def index():
    """Serve the main app page"""
    return render_template('index.html')


# ===================================
# Routes - Trip API
# ===================================

@app.route('/api/trips', methods=['GET'])
def get_trips():
    """Get trips for logged-in phone"""
    phone = session.get('phone')
    if not phone:
        return jsonify({'error': 'Login required'}), 401
    
    trips = (
        Trip.query.join(Participant)
        .filter(Participant.phone == phone)
        .order_by(Trip.updated_at.desc())
        .all()
    )
    return jsonify([trip.to_dict() for trip in trips])


@app.route('/api/login', methods=['POST'])
def login():
    """Login with phone to list trips"""
    data = request.get_json()
    phone = (data.get('phone') or '').strip()
    if not phone:
        return jsonify({'error': 'Phone is required'}), 400
    
    session['phone'] = phone
    trips = (
        Trip.query.join(Participant)
        .filter(Participant.phone == phone)
        .order_by(Trip.updated_at.desc())
        .all()
    )
    return jsonify([trip.to_dict() for trip in trips])


@app.route('/api/logout', methods=['POST'])
def logout():
    """Clear session"""
    session.clear()
    return jsonify({'message': 'Logged out'})


@app.route('/api/trips', methods=['POST'])
def create_trip():
    """Create a new trip"""
    data = request.get_json()
    
    if not data.get('name'):
        return jsonify({'error': 'Trip name is required'}), 400
    
    members = data.get('members', [])
    if len(members) < 2:
        return jsonify({'error': 'At least 2 members required'}), 400

    admin_phone = (data.get('admin_phone') or session.get('phone') or '').strip()
    if not admin_phone:
        return jsonify({'error': 'Admin phone is required'}), 400

    seen_names = set()
    seen_phones = set()
    participants_payload = []
    for member in members:
        name = (member.get('name') or '').strip()
        phone = (member.get('phone') or '').strip()
        pin = (member.get('pin') or '').strip()
        if not name or not phone or not pin:
            return jsonify({'error': 'Name, phone, and PIN are required for each member'}), 400
        if name in seen_names:
            return jsonify({'error': 'Member names must be unique'}), 400
        if phone in seen_phones:
            return jsonify({'error': 'Phone numbers must be unique'}), 400
        seen_names.add(name)
        seen_phones.add(phone)
        participants_payload.append({
            'name': name,
            'phone': phone,
            'pin_hash': generate_password_hash(pin),
            'is_admin': phone == admin_phone
        })

    if admin_phone not in seen_phones:
        return jsonify({'error': 'Admin phone must be one of the participants'}), 400

    trip = Trip(
        name=data['name'],
        currency=data.get('currency', '₹')
    )
    db.session.add(trip)
    db.session.flush()

    for member in participants_payload:
        participant = Participant(
            trip_id=trip.id,
            name=member['name'],
            phone=member['phone'],
            pin_hash=member['pin_hash'],
            is_admin=member['is_admin']
        )
        db.session.add(participant)

    db.session.commit()

    session['phone'] = admin_phone
    session['authorized_trips'] = list(set(session.get('authorized_trips', []) + [trip.id]))

    return jsonify(trip.to_dict(include_members=True, current_phone=admin_phone)), 201


@app.route('/api/trips/<int:trip_id>/verify', methods=['POST'])
def verify_trip_access(trip_id):
    """Verify phone + PIN to access a specific trip"""
    data = request.get_json()
    phone = (data.get('phone') or '').strip()
    pin = (data.get('pin') or '').strip()
    if not phone or not pin:
        return jsonify({'error': 'Phone and PIN are required'}), 400
    
    participant = Participant.query.filter_by(trip_id=trip_id, phone=phone).first()
    if not participant or not check_password_hash(participant.pin_hash, pin):
        return jsonify({'error': 'Invalid phone or PIN'}), 403
    
    session['phone'] = phone
    session['authorized_trips'] = list(set(session.get('authorized_trips', []) + [trip_id]))

    trip = Trip.query.get_or_404(trip_id)
    trip_data = trip.to_dict(include_members=True, current_phone=phone)
    trip_data['expenses'] = [e.to_dict() for e in trip.expenses]
    return jsonify(trip_data)


@app.route('/api/trips/<int:trip_id>', methods=['GET'])
def get_trip(trip_id):
    """Get a specific trip with all expenses"""
    if trip_id not in session.get('authorized_trips', []):
        return jsonify({'error': 'Access denied'}), 403
    trip = Trip.query.get_or_404(trip_id)
    trip_data = trip.to_dict(include_members=True, current_phone=session.get('phone'))
    trip_data['expenses'] = [e.to_dict() for e in trip.expenses]
    return jsonify(trip_data)


@app.route('/api/trips/<int:trip_id>', methods=['PUT'])
def update_trip(trip_id):
    """Update trip details"""
    if trip_id not in session.get('authorized_trips', []):
        return jsonify({'error': 'Access denied'}), 403
    trip = Trip.query.get_or_404(trip_id)
    data = request.get_json()
    current_phone = session.get('phone')
    participant = Participant.query.filter_by(trip_id=trip_id, phone=current_phone).first()
    if not participant or not participant.is_admin:
        return jsonify({'error': 'Admin access required'}), 403
    
    if data.get('name'):
        trip.name = data['name']
    
    if data.get('currency'):
        trip.currency = data['currency']
    
    if data.get('members'):
        members = data['members']
        if len(members) < 2:
            return jsonify({'error': 'At least 2 members required'}), 400

        admin_phone = (data.get('admin_phone') or current_phone or '').strip()

        seen_names = set()
        seen_phones = set()
        for member in members:
            name = (member.get('name') or '').strip()
            phone = (member.get('phone') or '').strip()
            if not name or not phone:
                return jsonify({'error': 'Name and phone are required for each member'}), 400
            if name in seen_names:
                return jsonify({'error': 'Member names must be unique'}), 400
            if phone in seen_phones:
                return jsonify({'error': 'Phone numbers must be unique'}), 400
            seen_names.add(name)
            seen_phones.add(phone)

        if admin_phone not in seen_phones:
            return jsonify({'error': 'Admin phone must be one of the participants'}), 400

        if trip.expenses:
            if not data.get('confirm_clear_expenses'):
                return jsonify({
                    'warning': 'Changing members will require clearing expenses',
                    'needs_confirmation': True
                }), 409
            Expense.query.filter_by(trip_id=trip_id).delete()

        existing_participants = {p.phone: p for p in trip.participants}
        Participant.query.filter_by(trip_id=trip_id).delete()
        db.session.flush()

        for member in members:
            name = (member.get('name') or '').strip()
            phone = (member.get('phone') or '').strip()
            pin = (member.get('pin') or '').strip()
            if pin:
                pin_hash = generate_password_hash(pin)
            else:
                existing = existing_participants.get(phone)
                if not existing:
                    return jsonify({'error': 'PIN is required for new participants'}), 400
                pin_hash = existing.pin_hash

            db.session.add(Participant(
                trip_id=trip_id,
                name=name,
                phone=phone,
                pin_hash=pin_hash,
                is_admin=(phone == admin_phone)
            ))
    
    db.session.commit()
    return jsonify(trip.to_dict(include_members=True, current_phone=current_phone))


@app.route('/api/trips/<int:trip_id>', methods=['DELETE'])
def delete_trip(trip_id):
    """Delete a trip and all its expenses"""
    if trip_id not in session.get('authorized_trips', []):
        return jsonify({'error': 'Access denied'}), 403
    current_phone = session.get('phone')
    participant = Participant.query.filter_by(trip_id=trip_id, phone=current_phone).first()
    if not participant or not participant.is_admin:
        return jsonify({'error': 'Admin access required'}), 403
    trip = Trip.query.get_or_404(trip_id)
    db.session.delete(trip)
    db.session.commit()
    return jsonify({'message': 'Trip deleted'})


# ===================================
# Routes - Expense API
# ===================================

@app.route('/api/trips/<int:trip_id>/expenses', methods=['GET'])
def get_expenses(trip_id):
    """Get all expenses for a trip"""
    if trip_id not in session.get('authorized_trips', []):
        return jsonify({'error': 'Access denied'}), 403
    trip = Trip.query.get_or_404(trip_id)
    expenses = Expense.query.filter_by(trip_id=trip_id).order_by(Expense.created_at.desc()).all()
    return jsonify([e.to_dict() for e in expenses])


@app.route('/api/trips/<int:trip_id>/expenses', methods=['POST'])
def create_expense(trip_id):
    """Add a new expense to a trip"""
    if trip_id not in session.get('authorized_trips', []):
        return jsonify({'error': 'Access denied'}), 403
    trip = Trip.query.get_or_404(trip_id)
    data = request.get_json()
    
    if not data.get('description'):
        return jsonify({'error': 'Description is required'}), 400
    
    if not data.get('amount') or data['amount'] <= 0:
        return jsonify({'error': 'Valid amount is required'}), 400
    
    if not data.get('paid_by'):
        return jsonify({'error': 'Paid by is required'}), 400

    category = (data.get('category') or 'Miscellaneous').strip()
    if category not in EXPENSE_CATEGORIES:
        return jsonify({'error': 'Invalid category'}), 400
    
    split_between = data.get('split_between', [])
    if not split_between:
        return jsonify({'error': 'At least one person to split with is required'}), 400
    
    expense = Expense(
        trip_id=trip_id,
        description=data['description'],
        amount=float(data['amount']),
        category=category,
        paid_by=data['paid_by'],
        split_between=json.dumps(split_between)
    )
    
    db.session.add(expense)
    db.session.commit()
    
    return jsonify(expense.to_dict()), 201


@app.route('/api/trips/<int:trip_id>/expenses/<int:expense_id>', methods=['DELETE'])
def delete_expense(trip_id, expense_id):
    """Delete an expense"""
    if trip_id not in session.get('authorized_trips', []):
        return jsonify({'error': 'Access denied'}), 403
    expense = Expense.query.filter_by(id=expense_id, trip_id=trip_id).first_or_404()
    db.session.delete(expense)
    db.session.commit()
    return jsonify({'message': 'Expense deleted'})


# ===================================
# Routes - Calculations API
# ===================================

@app.route('/api/trips/<int:trip_id>/balances', methods=['GET'])
def get_balances(trip_id):
    """Calculate and return balances for all members"""
    if trip_id not in session.get('authorized_trips', []):
        return jsonify({'error': 'Access denied'}), 403
    trip = Trip.query.get_or_404(trip_id)
    members = [p.name for p in trip.participants]
    expenses = trip.expenses
    
    # Initialize balances
    balances = {member: 0.0 for member in members}
    
    # Calculate balances
    for expense in expenses:
        split_between = json.loads(expense.split_between)
        split_amount = expense.amount / len(split_between)
        
        # Person who paid gets credit
        if expense.paid_by in balances:
            balances[expense.paid_by] += expense.amount
        
        # Each person in the split owes their share
        for person in split_between:
            if person in balances:
                balances[person] -= split_amount
    
    # Round to 2 decimal places
    balances = {k: round(v, 2) for k, v in balances.items()}
    
    return jsonify(balances)


@app.route('/api/trips/<int:trip_id>/settlements', methods=['GET'])
def get_settlements(trip_id):
    """Calculate optimal settlements to minimize transactions"""
    if trip_id not in session.get('authorized_trips', []):
        return jsonify({'error': 'Access denied'}), 403
    trip = Trip.query.get_or_404(trip_id)
    members = [p.name for p in trip.participants]
    expenses = trip.expenses
    
    # Calculate balances first
    balances = {member: 0.0 for member in members}
    
    for expense in expenses:
        split_between = json.loads(expense.split_between)
        split_amount = expense.amount / len(split_between)
        
        if expense.paid_by in balances:
            balances[expense.paid_by] += expense.amount
        
        for person in split_between:
            if person in balances:
                balances[person] -= split_amount
    
    # Separate into debtors and creditors
    debtors = []
    creditors = []
    
    for name, balance in balances.items():
        if balance < -0.01:
            debtors.append({'name': name, 'amount': abs(balance)})
        elif balance > 0.01:
            creditors.append({'name': name, 'amount': balance})
    
    # Sort by amount (largest first)
    debtors.sort(key=lambda x: x['amount'], reverse=True)
    creditors.sort(key=lambda x: x['amount'], reverse=True)
    
    # Calculate settlements
    settlements = []
    i, j = 0, 0
    
    while i < len(debtors) and j < len(creditors):
        debtor = debtors[i]
        creditor = creditors[j]
        amount = min(debtor['amount'], creditor['amount'])
        
        if amount > 0.01:
            settlements.append({
                'from': debtor['name'],
                'to': creditor['name'],
                'amount': round(amount, 2)
            })
        
        debtor['amount'] -= amount
        creditor['amount'] -= amount
        
        if debtor['amount'] < 0.01:
            i += 1
        if creditor['amount'] < 0.01:
            j += 1
    
    return jsonify(settlements)


# ===================================
# Run the app
# ===================================

if __name__ == '__main__':
    app.run(debug=True, port=5000)

