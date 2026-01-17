"""
SplitTrip - Expense Tracker
Flask backend with SQLite database
"""

import os
import json
from datetime import datetime
from flask import Flask, render_template, request, jsonify
from flask_sqlalchemy import SQLAlchemy

# Initialize Flask app
app = Flask(__name__)

# Database configuration
basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'splittrip.db')
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
    members = db.Column(db.Text, nullable=False)  # JSON array of member names
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship with expenses
    expenses = db.relationship('Expense', backref='trip', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'currency': self.currency,
            'members': json.loads(self.members),
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'expense_count': len(self.expenses),
            'total_amount': sum(e.amount for e in self.expenses)
        }


class Expense(db.Model):
    """Expense model - stores individual expenses"""
    id = db.Column(db.Integer, primary_key=True)
    trip_id = db.Column(db.Integer, db.ForeignKey('trip.id'), nullable=False)
    description = db.Column(db.String(200), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    paid_by = db.Column(db.String(100), nullable=False)
    split_between = db.Column(db.Text, nullable=False)  # JSON array of member names
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'trip_id': self.trip_id,
            'description': self.description,
            'amount': self.amount,
            'paid_by': self.paid_by,
            'split_between': json.loads(self.split_between),
            'created_at': self.created_at.isoformat(),
            'timestamp': int(self.created_at.timestamp() * 1000)
        }


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
    """Get all trips"""
    trips = Trip.query.order_by(Trip.updated_at.desc()).all()
    return jsonify([trip.to_dict() for trip in trips])


@app.route('/api/trips', methods=['POST'])
def create_trip():
    """Create a new trip"""
    data = request.get_json()
    
    if not data.get('name'):
        return jsonify({'error': 'Trip name is required'}), 400
    
    members = data.get('members', [])
    if len(members) < 4:
        return jsonify({'error': 'At least 4 members required'}), 400
    
    trip = Trip(
        name=data['name'],
        currency=data.get('currency', '₹'),
        members=json.dumps(members)
    )
    
    db.session.add(trip)
    db.session.commit()
    
    return jsonify(trip.to_dict()), 201


@app.route('/api/trips/<int:trip_id>', methods=['GET'])
def get_trip(trip_id):
    """Get a specific trip with all expenses"""
    trip = Trip.query.get_or_404(trip_id)
    trip_data = trip.to_dict()
    trip_data['expenses'] = [e.to_dict() for e in trip.expenses]
    return jsonify(trip_data)


@app.route('/api/trips/<int:trip_id>', methods=['PUT'])
def update_trip(trip_id):
    """Update trip details"""
    trip = Trip.query.get_or_404(trip_id)
    data = request.get_json()
    
    if data.get('name'):
        trip.name = data['name']
    
    if data.get('currency'):
        trip.currency = data['currency']
    
    if data.get('members'):
        members = data['members']
        if len(members) < 4:
            return jsonify({'error': 'At least 4 members required'}), 400
        
        # If members changed and there are expenses, check if we should clear them
        old_members = set(json.loads(trip.members))
        new_members = set(members)
        
        if old_members != new_members and trip.expenses:
            if not data.get('confirm_clear_expenses'):
                return jsonify({
                    'warning': 'Changing members will require clearing expenses',
                    'needs_confirmation': True
                }), 409
            # Clear expenses if confirmed
            Expense.query.filter_by(trip_id=trip_id).delete()
        
        trip.members = json.dumps(members)
    
    db.session.commit()
    return jsonify(trip.to_dict())


@app.route('/api/trips/<int:trip_id>', methods=['DELETE'])
def delete_trip(trip_id):
    """Delete a trip and all its expenses"""
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
    trip = Trip.query.get_or_404(trip_id)
    expenses = Expense.query.filter_by(trip_id=trip_id).order_by(Expense.created_at.desc()).all()
    return jsonify([e.to_dict() for e in expenses])


@app.route('/api/trips/<int:trip_id>/expenses', methods=['POST'])
def create_expense(trip_id):
    """Add a new expense to a trip"""
    trip = Trip.query.get_or_404(trip_id)
    data = request.get_json()
    
    if not data.get('description'):
        return jsonify({'error': 'Description is required'}), 400
    
    if not data.get('amount') or data['amount'] <= 0:
        return jsonify({'error': 'Valid amount is required'}), 400
    
    if not data.get('paid_by'):
        return jsonify({'error': 'Paid by is required'}), 400
    
    split_between = data.get('split_between', [])
    if not split_between:
        return jsonify({'error': 'At least one person to split with is required'}), 400
    
    expense = Expense(
        trip_id=trip_id,
        description=data['description'],
        amount=float(data['amount']),
        paid_by=data['paid_by'],
        split_between=json.dumps(split_between)
    )
    
    db.session.add(expense)
    db.session.commit()
    
    return jsonify(expense.to_dict()), 201


@app.route('/api/trips/<int:trip_id>/expenses/<int:expense_id>', methods=['DELETE'])
def delete_expense(trip_id, expense_id):
    """Delete an expense"""
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
    trip = Trip.query.get_or_404(trip_id)
    members = json.loads(trip.members)
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
    trip = Trip.query.get_or_404(trip_id)
    members = json.loads(trip.members)
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

