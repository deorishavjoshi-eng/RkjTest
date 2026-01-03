from flask import Flask, request, jsonify, session, redirect, url_for
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
import jwt
import datetime
import os
from functools import wraps
import google.oauth2.credentials
import google_auth_oauthlib.flow
import googleapiclient.discovery
from googleapiclient.http import MediaFileUpload
from googleapiclient.errors import HttpError

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-here'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///repeaters.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Google Drive API configuration
CLIENT_SECRETS_FILE = "client_secret.json"
SCOPES = ['https://www.googleapis.com/auth/drive.file']
API_SERVICE_NAME = 'drive'
API_VERSION = 'v3'

CORS(app)
db = SQLAlchemy(app)

# Database Models
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)
    phone = db.Column(db.String(20))
    role = db.Column(db.String(20), default='student')
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    google_id = db.Column(db.String(100))
    drive_token = db.Column(db.Text)
    
    # Relationships
    enrollments = db.relationship('Enrollment', backref='user', lazy=True)
    payments = db.relationship('Payment', backref='user', lazy=True)

class Course(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    code = db.Column(db.String(20), unique=True, nullable=False)
    description = db.Column(db.Text)
    price = db.Column(db.Float, nullable=False)
    duration = db.Column(db.String(50))
    instructor = db.Column(db.String(100))
    category = db.Column(db.String(50))  # ssc-cgl, ssc-chsl, etc.
    drive_folder_id = db.Column(db.String(100))
    
    enrollments = db.relationship('Enrollment', backref='course', lazy=True)
    materials = db.relationship('StudyMaterial', backref='course', lazy=True)

class Enrollment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    course_id = db.Column(db.Integer, db.ForeignKey('course.id'), nullable=False)
    enrolled_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    status = db.Column(db.String(20), default='active')
    batch = db.Column(db.String(50))
    expiry_date = db.Column(db.DateTime)

class StudyMaterial(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    course_id = db.Column(db.Integer, db.ForeignKey('course.id'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    file_url = db.Column(db.String(500))
    drive_file_id = db.Column(db.String(100))
    file_type = db.Column(db.String(50))  # pdf, video, document
    uploaded_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    size = db.Column(db.String(20))

class Payment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    course_id = db.Column(db.Integer, db.ForeignKey('course.id'), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    payment_id = db.Column(db.String(100), unique=True)
    method = db.Column(db.String(50))
    status = db.Column(db.String(20), default='pending')
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

# Token authentication decorator
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        
        if not token:
            return jsonify({'message': 'Token is missing!'}), 401
        
        try:
            data = jwt.decode(token.split()[1], app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = User.query.get(data['user_id'])
        except:
            return jsonify({'message': 'Token is invalid!'}), 401
        
        return f(current_user, *args, **kwargs)
    return decorated

# Routes
@app.route('/')
def home():
    return jsonify({
        'message': 'Welcome to The Repeaters Official API',
        'version': '1.0',
        'endpoints': {
            'auth': ['/register', '/login', '/logout'],
            'courses': ['/courses', '/courses/<id>'],
            'enrollment': ['/enroll', '/my-courses'],
            'materials': ['/materials', '/materials/<course_id>'],
            'payments': ['/create-payment', '/verify-payment']
        }
    })

# Authentication Routes
@app.route('/register', methods=['POST'])
def register():
    try:
        data = request.json
        
        # Check if user exists
        existing_user = User.query.filter_by(email=data['email']).first()
        if existing_user:
            return jsonify({'error': 'User already exists'}), 400
        
        # Create new user
        hashed_password = generate_password_hash(data['password'], method='sha256')
        new_user = User(
            name=data['name'],
            email=data['email'],
            password=hashed_password,
            phone=data.get('phone'),
            role='student'
        )
        
        db.session.add(new_user)
        db.session.commit()
        
        # Generate token
        token = jwt.encode({
            'user_id': new_user.id,
            'exp': datetime.datetime.utcnow() + datetime.timedelta(days=30)
        }, app.config['SECRET_KEY'])
        
        return jsonify({
            'message': 'User registered successfully',
            'token': token,
            'user': {
                'id': new_user.id,
                'name': new_user.name,
                'email': new_user.email,
                'role': new_user.role
            }
        }), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/login', methods=['POST'])
def login():
    try:
        data = request.json
        
        user = User.query.filter_by(email=data['email']).first()
        
        if not user or not check_password_hash(user.password, data['password']):
            return jsonify({'error': 'Invalid credentials'}), 401
        
        # Generate token
        token = jwt.encode({
            'user_id': user.id,
            'exp': datetime.datetime.utcnow() + datetime.timedelta(days=30)
        }, app.config['SECRET_KEY'])
        
        return jsonify({
            'message': 'Login successful',
            'token': token,
            'user': {
                'id': user.id,
                'name': user.name,
                'email': user.email,
                'role': user.role
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/google-auth', methods=['POST'])
def google_auth():
    try:
        data = request.json
        google_id = data['googleId']
        email = data['email']
        name = data['name']
        
        # Check if user exists
        user = User.query.filter_by(google_id=google_id).first()
        if not user:
            user = User.query.filter_by(email=email).first()
            if user:
                user.google_id = google_id
            else:
                # Create new user
                user = User(
                    name=name,
                    email=email,
                    google_id=google_id,
                    password=generate_password_hash(str(datetime.datetime.utcnow()), method='sha256'),
                    role='student'
                )
                db.session.add(user)
        db.session.commit()
        
        # Generate token
        token = jwt.encode({
            'user_id': user.id,
            'exp': datetime.datetime.utcnow() + datetime.timedelta(days=30)
        }, app.config['SECRET_KEY'])
        
        return jsonify({
            'message': 'Google authentication successful',
            'token': token,
            'user': {
                'id': user.id,
                'name': user.name,
                'email': user.email,
                'role': user.role
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Course Routes
@app.route('/courses', methods=['GET'])
def get_courses():
    try:
        category = request.args.get('category')
        query = Course.query
        
        if category:
            query = query.filter_by(category=category)
        
        courses = query.all()
        
        return jsonify({
            'courses': [{
                'id': course.id,
                'name': course.name,
                'code': course.code,
                'description': course.description,
                'price': course.price,
                'duration': course.duration,
                'instructor': course.instructor,
                'category': course.category
            } for course in courses]
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/courses/<int:course_id>', methods=['GET'])
def get_course(course_id):
    try:
        course = Course.query.get_or_404(course_id)
        
        return jsonify({
            'course': {
                'id': course.id,
                'name': course.name,
                'code': course.code,
                'description': course.description,
                'price': course.price,
                'duration': course.duration,
                'instructor': course.instructor,
                'category': course.category
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Enrollment Routes
@app.route('/enroll', methods=['POST'])
@token_required
def enroll_course(current_user):
    try:
        data = request.json
        course_id = data['course_id']
        batch = data.get('batch', 'morning')
        
        # Check if already enrolled
        existing_enrollment = Enrollment.query.filter_by(
            user_id=current_user.id,
            course_id=course_id,
            status='active'
        ).first()
        
        if existing_enrollment:
            return jsonify({'error': 'Already enrolled in this course'}), 400
        
        # Create enrollment
        enrollment = Enrollment(
            user_id=current_user.id,
            course_id=course_id,
            batch=batch,
            expiry_date=datetime.datetime.utcnow() + datetime.timedelta(days=365)
        )
        
        db.session.add(enrollment)
        db.session.commit()
        
        return jsonify({
            'message': 'Successfully enrolled in course',
            'enrollment_id': enrollment.id
        }), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/my-courses', methods=['GET'])
@token_required
def get_my_courses(current_user):
    try:
        enrollments = Enrollment.query.filter_by(
            user_id=current_user.id,
            status='active'
        ).all()
        
        courses = []
        for enrollment in enrollments:
            course = enrollment.course
            courses.append({
                'id': course.id,
                'name': course.name,
                'code': course.code,
                'enrolled_at': enrollment.enrolled_at.isoformat(),
                'batch': enrollment.batch,
                'expiry_date': enrollment.expiry_date.isoformat() if enrollment.expiry_date else None
            })
        
        return jsonify({'courses': courses}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Study Material Routes
@app.route('/materials/<int:course_id>', methods=['GET'])
@token_required
def get_course_materials(current_user, course_id):
    try:
        # Check if user is enrolled
        enrollment = Enrollment.query.filter_by(
            user_id=current_user.id,
            course_id=course_id,
            status='active'
        ).first()
        
        if not enrollment and current_user.role != 'admin':
            return jsonify({'error': 'Not enrolled in this course'}), 403
        
        materials = StudyMaterial.query.filter_by(course_id=course_id).all()
        
        return jsonify({
            'materials': [{
                'id': material.id,
                'title': material.title,
                'description': material.description,
                'file_url': material.file_url,
                'file_type': material.file_type,
                'uploaded_at': material.uploaded_at.isoformat(),
                'size': material.size
            } for material in materials]
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Google Drive Integration Routes
@app.route('/google-drive/auth')
def google_drive_auth():
    try:
        flow = google_auth_oauthlib.flow.Flow.from_client_secrets_file(
            CLIENT_SECRETS_FILE, 
            scopes=SCOPES
        )
        flow.redirect_uri = url_for('google_drive_callback', _external=True)
        
        authorization_url, state = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true'
        )
        
        session['state'] = state
        return redirect(authorization_url)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/google-drive/callback')
def google_drive_callback():
    try:
        state = session['state']
        flow = google_auth_oauthlib.flow.Flow.from_client_secrets_file(
            CLIENT_SECRETS_FILE,
            scopes=SCOPES,
            state=state
        )
        flow.redirect_uri = url_for('google_drive_callback', _external=True)
        
        authorization_response = request.url
        flow.fetch_token(authorization_response=authorization_response)
        
        credentials = flow.credentials
        
        # Save credentials for the user
        user_id = session.get('user_id')
        if user_id:
            user = User.query.get(user_id)
            if user:
                user.drive_token = credentials.to_json()
                db.session.commit()
        
        return jsonify({'message': 'Google Drive connected successfully'}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/upload-to-drive', methods=['POST'])
@token_required
def upload_to_drive(current_user):
    try:
        if not current_user.drive_token:
            return jsonify({'error': 'Google Drive not connected'}), 400
        
        # Parse credentials
        credentials = google.oauth2.credentials.Credentials.from_authorized_user_info(
            json.loads(current_user.drive_token)
        )
        
        # Create Drive service
        drive_service = googleapiclient.discovery.build(
            API_SERVICE_NAME, 
            API_VERSION, 
            credentials=credentials
        )
        
        file = request.files['file']
        course_id = request.form['course_id']
        
        # Get course folder ID
        course = Course.query.get(course_id)
        if not course.drive_folder_id:
            # Create folder for course
            folder_metadata = {
                'name': f'Course_{course.code}',
                'mimeType': 'application/vnd.google-apps.folder'
            }
            folder = drive_service.files().create(
                body=folder_metadata,
                fields='id'
            ).execute()
            course.drive_folder_id = folder.get('id')
            db.session.commit()
        
        # Upload file
        file_metadata = {
            'name': file.filename,
            'parents': [course.drive_folder_id]
        }
        media = MediaFileUpload(file.filename, mimetype=file.mimetype)
        
        uploaded_file = drive_service.files().create(
            body=file_metadata,
            media_body=media,
            fields='id, webViewLink'
        ).execute()
        
        # Save to database
        material = StudyMaterial(
            course_id=course_id,
            title=request.form.get('title', file.filename),
            description=request.form.get('description', ''),
            file_url=uploaded_file.get('webViewLink'),
            drive_file_id=uploaded_file.get('id'),
            file_type=file.mimetype,
            size=str(len(file.read()))
        )
        
        db.session.add(material)
        db.session.commit()
        
        return jsonify({
            'message': 'File uploaded successfully',
            'file_id': uploaded_file.get('id'),
            'view_link': uploaded_file.get('webViewLink')
        }), 201
        
    except HttpError as error:
        return jsonify({'error': f'Google Drive error: {error}'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Payment Routes
@app.route('/create-payment', methods=['POST'])
@token_required
def create_payment(current_user):
    try:
        data = request.json
        
        # Generate payment ID (in real app, use Razorpay/Stripe)
        payment_id = f'PAY_{datetime.datetime.utcnow().strftime("%Y%m%d%H%M%S")}_{current_user.id}'
        
        payment = Payment(
            user_id=current_user.id,
            course_id=data['course_id'],
            amount=data['amount'],
            payment_id=payment_id,
            method=data.get('method', 'online'),
            status='pending'
        )
        
        db.session.add(payment)
        db.session.commit()
        
        # In real app, create order with payment gateway
        return jsonify({
            'message': 'Payment order created',
            'payment_id': payment_id,
            'amount': data['amount'],
            'key': 'rzp_test_YOUR_KEY',  # Replace with actual key
            'name': 'The Repeaters Official',
            'description': f'Payment for {data["course_id"]}',
            'prefill': {
                'name': current_user.name,
                'email': current_user.email,
                'contact': current_user.phone or ''
            }
        }), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/verify-payment', methods=['POST'])
@token_required
def verify_payment(current_user):
    try:
        data = request.json
        payment_id = data['payment_id']
        razorpay_payment_id = data['razorpay_payment_id']
        razorpay_signature = data['razorpay_signature']
        
        # Verify payment signature (implement actual verification)
        payment = Payment.query.filter_by(payment_id=payment_id).first()
        if payment:
            payment.status = 'completed'
            db.session.commit()
            
            # Auto-enroll user in course
            enrollment = Enrollment(
                user_id=current_user.id,
                course_id=payment.course_id,
                status='active'
            )
            db.session.add(enrollment)
            db.session.commit()
            
            return jsonify({
                'message': 'Payment verified and enrollment completed',
                'enrollment_id': enrollment.id
            }), 200
        
        return jsonify({'error': 'Payment not found'}), 404
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Admin Routes
@app.route('/admin/users', methods=['GET'])
@token_required
def get_all_users(current_user):
    if current_user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403
    
    try:
        users = User.query.all()
        return jsonify({
            'users': [{
                'id': user.id,
                'name': user.name,
                'email': user.email,
                'role': user.role,
                'created_at': user.created_at.isoformat(),
                'enrollments': len(user.enrollments)
            } for user in users]
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/admin/stats', methods=['GET'])
@token_required
def get_stats(current_user):
    if current_user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403
    
    try:
        total_users = User.query.count()
        total_courses = Course.query.count()
        total_enrollments = Enrollment.query.count()
        total_payments = Payment.query.filter_by(status='completed').count()
        revenue = db.session.query(db.func.sum(Payment.amount)).filter_by(status='completed').scalar() or 0
        
        return jsonify({
            'stats': {
                'total_users': total_users,
                'total_courses': total_courses,
                'total_enrollments': total_enrollments,
                'total_payments': total_payments,
                'total_revenue': revenue,
                'active_users': Enrollment.query.distinct(Enrollment.user_id).count()
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        
        # Create default courses if they don't exist
        default_courses = [
            Course(
                name='SSC CHSL Complete Course',
                code='SSC-CHSL-2024',
                description='Complete preparation for SSC CHSL Tier I, II, and Typing Test',
                price=4999.00,
                duration='6 Months',
                instructor='Expert Faculty',
                category='ssc-chsl'
            ),
            Course(
                name='SSC CGL Tier I & II',
                code='SSC-CGL-2024',
                description='Comprehensive course for SSC CGL with advanced concepts',
                price=5999.00,
                duration='8 Months',
                instructor='Senior Mentor',
                category='ssc-cgl'
            ),
            Course(
                name='Railway NTPC CBT 1 & 2',
                code='RRB-NTPC-2024',
                description='Complete NTPC preparation with practice tests',
                price=3999.00,
                duration='4 Months',
                instructor='Railway Expert',
                category='ntpc'
            )
        ]
        
        for course in default_courses:
            if not Course.query.filter_by(code=course.code).first():
                db.session.add(course)
        
        db.session.commit()
    
    app.run(debug=True, port=5000)
