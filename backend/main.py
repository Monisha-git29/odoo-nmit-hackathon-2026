import os
import math
import shutil
import jwt
import bcrypt
from datetime import datetime, date, timedelta
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, status, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr

from database import engine, get_db
from models import (
    User, Employee, Department, Attendance, AttendanceCorrection, 
    LeaveBalance, LeaveRequest, EmployeeWorkSchedule, Payroll, Document, Notification
)
from face_verifier import FaceVerifier

# Load settings
JWT_SECRET = os.getenv("JWT_SECRET", "dayflow_super_secret_key_12345_every_workday_perfectly_aligned")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))

OFFICE_LAT = float(os.getenv("OFFICE_LATITUDE", "12.9716"))
OFFICE_LON = float(os.getenv("OFFICE_LONGITUDE", "77.5946"))
ALLOWED_RADIUS = float(os.getenv("ALLOWED_RADIUS_METERS", "100.0"))
REQUIRED_HOURS = float(os.getenv("REQUIRED_WORKING_HOURS", "8.0"))
DEV_MODE = os.getenv("DEVELOPMENT_MODE", "false").lower() == "true"
FACE_SIMILARITY_THRESHOLD = float(os.getenv("FACE_SIMILARITY_THRESHOLD", "0.78"))

app = FastAPI(title="Dayflow HRMS - Employee API", version="1.0.0")

# Enable CORS for React Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Upload directory
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# Initialize Face Verifier
face_verifier = FaceVerifier()
security = HTTPBearer()

# Pydantic Schemas
class LoginRequest(BaseModel):
    username_or_email: str
    password: str

class PasswordResetRequest(BaseModel):
    current_password: str
    new_password: str
    confirm_password: str

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str
    confirm_password: str

class ForgotPasswordRequest(BaseModel):
    email_or_employee_id: str

class ProfileUpdateRequest(BaseModel):
    phone: Optional[str] = None
    address: Optional[str] = None

class FaceEnrollRequest(BaseModel):
    image_base64: str
    is_front_camera: bool = True

class CheckInRequest(BaseModel):
    image_base64: str
    is_front_camera: bool = True
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class CheckOutRequest(BaseModel):
    image_base64: str
    is_front_camera: bool = True

class CorrectionRequestSchema(BaseModel):
    attendance_date: str
    issue_type: str
    requested_time: str
    reason: str

class LeaveRequestSchema(BaseModel):
    leave_type: str
    start_date: str
    end_date: str
    remarks: Optional[str] = None

# Helper functions
def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        username = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid token: missing subject.")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid session token.")
        
    user = db.query(User).filter(User.email == username).first()
    if not user:
        # Check if username is employee_id
        user = db.query(User).filter(User.employee_id == username).first()
        if not user:
            raise HTTPException(status_code=401, detail="User not found.")
    return user

def get_distance_meters(lat1, lon1, lat2, lon2):
    # Haversine distance
    R = 6371000.0  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    
    a = math.sin(dphi / 2.0)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2.0)**2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c

# Authentication Endpoints
@app.post("/api/auth/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    # Find user by Email or Employee ID
    user = db.query(User).filter((User.email == req.username_or_email) | (User.employee_id == req.username_or_email)).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Incorrect email/employee ID or password.")
        
    # Get associated employee
    employee = db.query(Employee).filter(Employee.employee_id == user.employee_id).first()
    emp_name = f"{employee.first_name} {employee.last_name}" if employee else "System Admin"
    
    token = create_access_token({"sub": user.employee_id})
    return {
        "access_token": token,
        "token_type": "bearer",
        "role": user.role,
        "employee_id": user.employee_id,
        "name": emp_name,
        "email": user.email,
        "temp_password_active": user.temp_password_active
    }

@app.post("/api/auth/reset-temp-password")
def reset_temp_password(req: PasswordResetRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not user.temp_password_active:
        raise HTTPException(status_code=400, detail="Password reset not required. Please use standard password change.")
        
    if not verify_password(req.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Incorrect current password.")
        
    if req.new_password != req.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match.")
        
    if len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")
        
    user.password_hash = hash_password(req.new_password)
    user.temp_password_active = False
    db.commit()
    return {"message": "Temporary password updated successfully. You can now access your dashboard."}

@app.post("/api/auth/change-password")
def change_password(req: ChangePasswordRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not verify_password(req.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Incorrect current password.")
        
    if req.new_password != req.confirm_password:
        raise HTTPException(status_code=400, detail="New passwords do not match.")
        
    if len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")
        
    user.password_hash = hash_password(req.new_password)
    db.commit()
    return {"message": "Password changed successfully."}

@app.post("/api/auth/forgot-password")
def forgot_password(req: ForgotPasswordRequest, db: Session = Depends(get_db)):
    # Verify user exists
    user = db.query(User).filter((User.email == req.email_or_employee_id) | (User.employee_id == req.email_or_employee_id)).first()
    if not user:
        raise HTTPException(status_code=400, detail="Email or Employee ID not found.")
        
    # Reset password to temporary "dayflow123"
    temp_pass = "dayflow123"
    user.password_hash = hash_password(temp_pass)
    user.temp_password_active = True
    db.commit()
    return {"message": f"Password reset successful. Temporary password is '{temp_pass}'. Please log in and change it."}

# Profile Endpoints
@app.get("/api/employee/profile")
def get_profile(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    employee = db.query(Employee).filter(Employee.employee_id == user.employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee details not found.")
        
    # Get payroll
    payroll = db.query(Payroll).filter(Payroll.employee_id == user.employee_id).first()
    
    # Get documents
    documents = db.query(Document).filter(Document.employee_id == user.employee_id).all()
    
    return {
        "employee_id": employee.employee_id,
        "first_name": employee.first_name,
        "last_name": employee.last_name,
        "email": employee.email,
        "phone": employee.phone,
        "address": employee.address,
        "date_of_birth": employee.date_of_birth,
        "gender": employee.gender,
        "designation": employee.designation,
        "department": employee.department.name,
        "joining_date": employee.joining_date,
        "employment_type": employee.employment_type,
        "work_mode": employee.work_mode,
        "has_enrolled_face": employee.registered_face_embedding is not None,
        "profile_picture": employee.profile_picture_path,
        "payroll": {
            "basic_salary": payroll.basic_salary if payroll else 0.0,
            "hra": payroll.hra if payroll else 0.0,
            "allowances": payroll.allowances if payroll else 0.0,
            "pf": payroll.pf if payroll else 0.0,
            "professional_tax": payroll.professional_tax if payroll else 0.0,
            "other_deductions": payroll.other_deductions if payroll else 0.0,
            "gross_salary": payroll.gross_salary if payroll else 0.0,
            "net_salary": payroll.net_salary if payroll else 0.0
        } if payroll else None,
        "documents": [{"id": doc.id, "name": doc.name, "type": doc.type, "path": f"/uploads/{os.path.basename(doc.file_path)}", "uploaded_at": doc.uploaded_at} for doc in documents]
    }

@app.put("/api/employee/profile")
def update_profile(req: ProfileUpdateRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    employee = db.query(Employee).filter(Employee.employee_id == user.employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found.")
        
    if req.phone is not None:
        employee.phone = req.phone
    if req.address is not None:
        employee.address = req.address
        
    db.commit()
    return {"message": "Profile updated successfully."}

@app.post("/api/employee/profile-picture")
def upload_profile_picture(file: UploadFile = File(...), user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    employee = db.query(Employee).filter(Employee.employee_id == user.employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found.")
        
    ext = os.path.splitext(file.filename)[1]
    filename = f"profile_{user.employee_id}{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    
    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    employee.profile_picture_path = f"/uploads/{filename}"
    db.commit()
    return {"message": "Profile picture updated successfully.", "path": employee.profile_picture_path}

@app.post("/api/employee/upload-document")
def upload_document(name: str = Form(...), type: str = Form(...), file: UploadFile = File(...), user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    employee = db.query(Employee).filter(Employee.employee_id == user.employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found.")
        
    # Generate unique filename
    ext = os.path.splitext(file.filename)[1]
    filename = f"doc_{type.lower()}_{user.employee_id}_{int(datetime.utcnow().timestamp())}{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    
    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # Create document record
    doc = Document(
        employee_id=user.employee_id,
        name=name,
        type=type, # RESUME, CERTIFICATE
        file_path=filepath
    )
    db.add(doc)
    db.commit()
    return {"message": f"{type.capitalize()} uploaded successfully."}

@app.delete("/api/employee/documents/{doc_id}")
def delete_document(doc_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    doc = db.query(Document).filter((Document.id == doc_id) & (Document.employee_id == user.employee_id)).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found or access denied.")
        
    # Delete from filesystem
    if os.path.exists(doc.file_path):
        try:
            os.remove(doc.file_path)
        except Exception:
            pass
            
    db.delete(doc)
    db.commit()
    return {"message": "Document deleted successfully."}

# Attendance Endpoints
@app.get("/api/attendance/today")
def get_today_attendance(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    employee = db.query(Employee).filter(Employee.employee_id == user.employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found.")
        
    today = date.today()
    
    # 1. Fetch today's schedule for Hybrid employees
    today_work_mode = employee.work_mode
    if employee.work_mode == "HYBRID":
        sched = db.query(EmployeeWorkSchedule).filter(
            (EmployeeWorkSchedule.employee_id == user.employee_id) & 
            (EmployeeWorkSchedule.date == today)
        ).first()
        today_work_mode = sched.work_mode if sched else "OFFICE" # Default to OFFICE if unscheduled
        
    # 2. Fetch today's attendance record
    att = db.query(Attendance).filter(
        (Attendance.employee_id == user.employee_id) & 
        (Attendance.date == today)
    ).first()
    
    # Check if on approved leave today
    leave = db.query(LeaveRequest).filter(
        (LeaveRequest.employee_id == user.employee_id) &
        (LeaveRequest.status == "APPROVED") &
        (LeaveRequest.start_date <= today) &
        (LeaveRequest.end_date >= today)
    ).first()
    
    status_str = "NOT_CHECKED_IN"
    check_in_time = None
    check_out_time = None
    work_hours = 0.0
    extra_hours = 0.0
    
    if leave:
        status_str = "LEAVE"
    elif att:
        status_str = att.status
        check_in_time = att.check_in_time
        check_out_time = att.check_out_time
        work_hours = att.work_hours
        extra_hours = att.extra_hours
        
    return {
        "date": today.strftime("%Y-%m-%d"),
        "employee_work_mode": employee.work_mode, # General
        "today_work_mode": today_work_mode, # Scheduled mode
        "status": status_str,
        "check_in_time": check_in_time.strftime("%I:%M %p") if check_in_time else "--",
        "check_out_time": check_out_time.strftime("%I:%M %p") if check_out_time else "--",
        "work_hours": work_hours,
        "extra_hours": extra_hours,
        "geofence": {
            "office_latitude": OFFICE_LAT,
            "office_longitude": OFFICE_LON,
            "allowed_radius_meters": ALLOWED_RADIUS
        }
    }

@app.post("/api/attendance/enroll-face")
def enroll_face(req: FaceEnrollRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    employee = db.query(Employee).filter(Employee.employee_id == user.employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found.")
        
    try:
        img = face_verifier.decode_base64_image(req.image_base64)
        embedding = face_verifier.get_face_embedding(img, is_front_camera=req.is_front_camera)
        
        # Save embedding
        employee.registered_face_embedding = embedding
        db.commit()
        
        return {"message": "Face registered successfully. You can now mark attendance."}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Face registration failed: {str(e)}")

@app.post("/api/attendance/check-in")
def check_in(req: CheckInRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    employee = db.query(Employee).filter(Employee.employee_id == user.employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found.")
        
    if not employee.registered_face_embedding:
        raise HTTPException(status_code=400, detail="Face embedding not enrolled. Please go to My Profile -> Security to register your face.")
        
    today = date.today()
    
    # Check if already checked in today
    att = db.query(Attendance).filter((Attendance.employee_id == user.employee_id) & (Attendance.date == today)).first()
    if att and att.status != "NOT_CHECKED_IN":
        raise HTTPException(status_code=400, detail="Already checked in for today.")
        
    # Determine today's required mode
    today_work_mode = employee.work_mode
    if employee.work_mode == "HYBRID":
        sched = db.query(EmployeeWorkSchedule).filter((EmployeeWorkSchedule.employee_id == user.employee_id) & (EmployeeWorkSchedule.date == today)).first()
        today_work_mode = sched.work_mode if sched else "OFFICE"
        
    # 1. Location geofence verification (for OFFICE mode only)
    location_verified = False
    distance = None
    if today_work_mode == "OFFICE":
        if req.latitude is None or req.longitude is None:
            if DEV_MODE:
                location_verified = True
                print("Development Mode: Location coordinates are missing, geofence bypassed.")
            else:
                raise HTTPException(status_code=400, detail="Office work mode requires location services. Please allow access and share coordinates.")
        else:
            distance = get_distance_meters(req.latitude, req.longitude, OFFICE_LAT, OFFICE_LON)
            if distance <= ALLOWED_RADIUS:
                location_verified = True
            elif DEV_MODE:
                location_verified = True
                print(f"Development Mode: Geofence check bypassed. Employee is {int(distance)}m away from office.")
            else:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Location verification failed. You are outside the allowed office radius ({int(distance)}m away, limit is {int(ALLOWED_RADIUS)}m)."
                )
    else:
        # WFH doesn't require geofence
        location_verified = True
        
    # 2. Face verification
    face_verified = False
    try:
        img = face_verifier.decode_base64_image(req.image_base64)
        current_embedding = face_verifier.get_face_embedding(img, is_front_camera=req.is_front_camera)
        
        similarity = face_verifier.compare_embeddings(current_embedding, employee.registered_face_embedding)
        
        # Use configurable threshold
        if similarity >= FACE_SIMILARITY_THRESHOLD:
            face_verified = True
        else:
            raise HTTPException(
                status_code=400, 
                detail=f"Face verification failed. Embedding similarity ({similarity:.2f}) is below threshold ({FACE_SIMILARITY_THRESHOLD:.2f}). Please align your face clearly."
            )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Face engine error: {str(e)}")
        
    # Create or update attendance record
    if not att:
        att = Attendance(
            employee_id=user.employee_id,
            date=today,
            work_mode=today_work_mode
        )
        db.add(att)
        
    att.check_in_time = datetime.now()
    att.status = "CHECKED_IN"
    att.face_verified = face_verified
    att.location_verified = location_verified
    db.commit()
    
    return {
        "message": "Check-in successful!",
        "time": att.check_in_time.strftime("%I:%M %p"),
        "distance_m": distance
    }

@app.post("/api/attendance/check-out")
def check_out(req: CheckOutRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    employee = db.query(Employee).filter(Employee.employee_id == user.employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found.")
        
    today = date.today()
    att = db.query(Attendance).filter((Attendance.employee_id == user.employee_id) & (Attendance.date == today)).first()
    
    if not att or att.status != "CHECKED_IN":
        raise HTTPException(status_code=400, detail="Cannot check out: No active check-in record found for today.")
        
    # Face verification before check-out
    face_verified = False
    try:
        img = face_verifier.decode_base64_image(req.image_base64)
        current_embedding = face_verifier.get_face_embedding(img, is_front_camera=req.is_front_camera)
        similarity = face_verifier.compare_embeddings(current_embedding, employee.registered_face_embedding)
        
        # Use configurable threshold
        if similarity >= FACE_SIMILARITY_THRESHOLD:
            face_verified = True
        else:
            raise HTTPException(
                status_code=400, 
                detail=f"Face verification failed. Embedding similarity ({similarity:.2f}) is below threshold ({FACE_SIMILARITY_THRESHOLD:.2f})."
            )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Face verification failed: {str(e)}")
        
    # Calculate hours
    checkout_time = datetime.now()
    checkin_time = att.check_in_time
    
    delta = checkout_time - checkin_time
    work_hrs = delta.total_seconds() / 3600.0
    extra_hrs = max(0.0, work_hrs - REQUIRED_HOURS)
    
    att.check_out_time = checkout_time
    att.work_hours = round(work_hrs, 2)
    att.extra_hours = round(extra_hrs, 2)
    att.status = "COMPLETED"
    
    # Finalize status based on work hours
    if work_hrs >= REQUIRED_HOURS:
        att.status = "PRESENT"
    elif work_hrs >= (REQUIRED_HOURS / 2.0):
        att.status = "HALF_DAY"
    else:
        att.status = "INCOMPLETE"
        
    db.commit()
    return {
        "message": "Check-out successful!",
        "time": checkout_time.strftime("%I:%M %p"),
        "work_hours": att.work_hours,
        "extra_hours": att.extra_hours,
        "status": att.status
    }

@app.get("/api/attendance/history")
def get_attendance_history(month: Optional[int] = None, year: Optional[int] = None, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(Attendance).filter(Attendance.employee_id == user.employee_id)
    
    # Date filters
    if month and year:
        start_date = date(year, month, 1)
        if month == 12:
            end_date = date(year + 1, 1, 1) - timedelta(days=1)
        else:
            end_date = date(year, month + 1, 1) - timedelta(days=1)
        query = query.filter((Attendance.date >= start_date) & (Attendance.date <= end_date))
        
    records = query.order_by(Attendance.date.desc()).all()
    
    # Calculate summary stats
    present_days = sum(1 for r in records if r.status in ["PRESENT", "COMPLETED"])
    half_days = sum(1 for r in records if r.status == "HALF_DAY")
    absent_days = sum(1 for r in records if r.status == "ABSENT")
    leave_days = sum(1 for r in records if r.status == "LEAVE")
    incomplete_days = sum(1 for r in records if r.status == "INCOMPLETE")
    
    history_list = []
    for r in records:
        history_list.append({
            "date": r.date.strftime("%Y-%m-%d"),
            "work_mode": r.work_mode,
            "check_in": r.check_in_time.strftime("%I:%M %p") if r.check_in_time else "--",
            "check_out": r.check_out_time.strftime("%I:%M %p") if r.check_out_time else "--",
            "work_hours": f"{int(r.work_hours)}h {int((r.work_hours % 1)*60)}m" if r.work_hours > 0 else "--",
            "extra_hours": f"{int(r.extra_hours)}h {int((r.extra_hours % 1)*60)}m" if r.extra_hours > 0 else "--",
            "status": r.status
        })
        
    return {
        "summary": {
            "present": present_days,
            "half_day": half_days,
            "absent": absent_days,
            "leave": leave_days,
            "incomplete": incomplete_days,
            "total_records": len(records)
        },
        "history": history_list
    }

def get_expected_working_days(start_date: date, end_date: date) -> int:
    count = 0
    curr = start_date
    while curr <= end_date:
        if curr.weekday() < 5:  # Mon=0 to Fri=4
            count += 1
        curr += timedelta(days=1)
    return count

@app.get("/api/attendance/insights")
def get_attendance_insights(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    employee = db.query(Employee).filter(Employee.employee_id == user.employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found.")
        
    today_dt = date.today()
    start_of_month = date(today_dt.year, today_dt.month, 1)
    
    # 1. Expected working days (weekdays in current month up to today)
    expected_days = get_expected_working_days(start_of_month, today_dt)
    
    # 2. Get approved leaves for the current month
    leaves = db.query(LeaveRequest).filter(
        (LeaveRequest.employee_id == user.employee_id) &
        (LeaveRequest.status == "APPROVED") &
        (LeaveRequest.start_date <= today_dt) &
        (LeaveRequest.end_date >= start_of_month)
    ).all()
    
    leave_dates = set()
    for l in leaves:
        curr = max(start_of_month, l.start_date)
        end = min(today_dt, l.end_date)
        while curr <= end:
            if curr.weekday() < 5:
                leave_dates.add(curr)
            curr += timedelta(days=1)
            
    # 3. Get all attendance records for this month
    att_records = db.query(Attendance).filter(
        (Attendance.employee_id == user.employee_id) &
        (Attendance.date >= start_of_month) &
        (Attendance.date <= today_dt)
    ).all()
    
    att_map = {r.date: r for r in att_records}
    
    present_days = 0
    leave_days = len(leave_dates)
    absent_days = 0
    late_checkins = 0
    missing_checkouts = 0
    incomplete_records = 0
    work_hours_sum = 0.0
    work_hours_count = 0
    
    curr = start_of_month
    while curr <= today_dt:
        if curr.weekday() >= 5:
            curr += timedelta(days=1)
            continue
            
        is_today = (curr == today_dt)
        
        if curr in leave_dates:
            pass
        elif curr in att_map:
            r = att_map[curr]
            if r.status in ["PRESENT", "COMPLETED", "HALF_DAY"]:
                present_days += 1
                if r.work_hours > 0:
                    work_hours_sum += r.work_hours
                    work_hours_count += 1
            elif r.status == "INCOMPLETE":
                incomplete_records += 1
            elif r.status == "ABSENT":
                absent_days += 1
                
            # Check late check-in (after 09:15 AM)
            if r.check_in_time:
                time_of_day = r.check_in_time.time()
                if time_of_day.hour > 9 or (time_of_day.hour == 9 and time_of_day.minute > 15):
                    late_checkins += 1
                    
            # Check missing check-out (for past dates)
            if not is_today and r.check_in_time and not r.check_out_time:
                missing_checkouts += 1
        else:
            # No attendance and no leave
            if not is_today:
                absent_days += 1
                
        curr += timedelta(days=1)
        
    avg_hours = round(work_hours_sum / work_hours_count, 2) if work_hours_count > 0 else 0.0
    consistency = round((present_days / expected_days) * 100.0, 1) if expected_days > 0 else 100.0
    
    # Generate insights
    insights = []
    if consistency >= 90:
        insights.append(f"Great consistency! Your attendance this month is {consistency}%. Keep up the excellent work!")
    elif consistency >= 75:
        insights.append(f"Good effort. Your attendance is {consistency}%. Try to clock in regularly to reach 90%.")
    else:
        insights.append(f"Your attendance consistency is currently {consistency}%. Please review your records.")
        
    if late_checkins > 0:
        insights.append(f"You have checked in late {late_checkins} time(s) this month.")
        
    if missing_checkouts > 0:
        insights.append(f"You have {missing_checkouts} missing check-out(s) this month.")
        
    if incomplete_records > 0:
        insights.append(f"You have {incomplete_records} incomplete attendance record(s) that may require correction.")
        
    return {
        "expected_working_days": expected_days,
        "present_days": present_days,
        "leave_days": leave_days,
        "absent_days": absent_days,
        "late_checkins": late_checkins,
        "missing_checkouts": missing_checkouts,
        "incomplete_records": incomplete_records,
        "average_work_hours": avg_hours,
        "consistency_percentage": consistency,
        "insights": insights
    }

@app.post("/api/attendance/correction")
def submit_correction(req: CorrectionRequestSchema, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        att_date = datetime.strptime(req.attendance_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")
        
    # Check if correction request already exists for this date
    exist = db.query(AttendanceCorrection).filter(
        (AttendanceCorrection.employee_id == user.employee_id) & 
        (AttendanceCorrection.attendance_date == att_date)
    ).first()
    
    if exist and exist.status == "PENDING":
        raise HTTPException(status_code=400, detail="A pending correction request already exists for this date.")
        
    correction = AttendanceCorrection(
        employee_id=user.employee_id,
        attendance_date=att_date,
        issue_type=req.issue_type,
        requested_time=req.requested_time,
        reason=req.reason
    )
    db.add(correction)
    db.commit()
    return {"message": "Attendance correction request submitted successfully. Awaiting HR approval."}

@app.get("/api/attendance/corrections")
def get_corrections(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    records = db.query(AttendanceCorrection).filter(
        AttendanceCorrection.employee_id == user.employee_id
    ).order_by(AttendanceCorrection.created_at.desc()).all()
    
    return [{
        "id": r.id,
        "attendance_date": r.attendance_date.strftime("%Y-%m-%d"),
        "issue_type": r.issue_type,
        "requested_time": r.requested_time,
        "reason": r.reason,
        "status": r.status,
        "created_at": r.created_at.strftime("%Y-%m-%d")
    } for r in records]

# Time Off / Leave Endpoints
@app.get("/api/timeoff/balance")
def get_leave_balance(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    bal = db.query(LeaveBalance).filter(LeaveBalance.employee_id == user.employee_id).first()
    if not bal:
        # Auto-create if not exists
        bal = LeaveBalance(employee_id=user.employee_id)
        db.add(bal)
        db.commit()
        
    return {
        "paid_leave": bal.paid_leave,
        "sick_leave": bal.sick_leave,
        "unpaid_leave": bal.unpaid_leave
    }

@app.post("/api/timeoff/check-conflicts")
def check_leave_conflicts(req: LeaveRequestSchema, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        s_date = datetime.strptime(req.start_date, "%Y-%m-%d").date()
        e_date = datetime.strptime(req.end_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")
        
    if s_date > e_date:
        raise HTTPException(status_code=400, detail="Start date cannot be after end date.")
        
    # Get employee details to find department
    employee = db.query(Employee).filter(Employee.employee_id == user.employee_id).first()
    
    # Query overlapping approved leave requests from other team members in the same department
    overlapping = db.query(LeaveRequest).join(Employee, LeaveRequest.employee_id == Employee.employee_id).filter(
        (Employee.department_id == employee.department_id) &
        (LeaveRequest.employee_id != user.employee_id) &
        (LeaveRequest.status == "APPROVED") &
        (LeaveRequest.start_date <= e_date) &
        (LeaveRequest.end_date >= s_date)
    ).all()
    
    return {
        "conflict_count": len(overlapping),
        "warning": len(overlapping) > 0,
        "message": f"{len(overlapping)} team members from your department are already on approved leave during this period." if len(overlapping) > 0 else "No team conflicts. Team availability is good."
    }

@app.post("/api/timeoff/apply")
def apply_leave(
    leave_type: str = Form(...),
    start_date: str = Form(...),
    end_date: str = Form(...),
    remarks: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        s_date = datetime.strptime(start_date, "%Y-%m-%d").date()
        e_date = datetime.strptime(end_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")
        
    if s_date > e_date:
        raise HTTPException(status_code=400, detail="Start date cannot be after end date.")
        
    # Calculate days (inclusive)
    num_days = (e_date - s_date).days + 1
    
    # Check balance
    bal = db.query(LeaveBalance).filter(LeaveBalance.employee_id == user.employee_id).first()
    if not bal:
        bal = LeaveBalance(employee_id=user.employee_id)
        db.add(bal)
        db.commit()
        
    if leave_type == "Paid Leave" and bal.paid_leave < num_days:
        raise HTTPException(status_code=400, detail=f"Insufficient Paid Leave balance. Requested: {num_days}, Balance: {bal.paid_leave}")
    elif leave_type == "Sick Leave" and bal.sick_leave < num_days:
        raise HTTPException(status_code=400, detail=f"Insufficient Sick Leave balance. Requested: {num_days}, Balance: {bal.sick_leave}")
        
    attachment_path = None
    if file:
        ext = os.path.splitext(file.filename)[1]
        filename = f"leave_attachment_{user.employee_id}_{int(datetime.utcnow().timestamp())}{ext}"
        attachment_path = os.path.join(UPLOAD_DIR, filename)
        with open(attachment_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        attachment_path = f"/uploads/{filename}"
            
    # Deduct balance provisionally or wait until approval? 
    # Usually balance is deducted on approval, but we can check limit here
    leave = LeaveRequest(
        employee_id=user.employee_id,
        leave_type=leave_type,
        start_date=s_date,
        end_date=e_date,
        num_days=float(num_days),
        remarks=remarks,
        attachment_path=attachment_path,
        status="PENDING"
    )
    db.add(leave)
    db.commit()
    
    return {"message": "Leave application submitted successfully. Awaiting HR review.", "num_days": num_days}

@app.get("/api/timeoff/history")
def get_leave_history(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    records = db.query(LeaveRequest).filter(
        LeaveRequest.employee_id == user.employee_id
    ).order_by(LeaveRequest.created_at.desc()).all()
    
    return [{
        "id": r.id,
        "leave_type": r.leave_type,
        "start_date": r.start_date.strftime("%Y-%m-%d"),
        "end_date": r.end_date.strftime("%Y-%m-%d"),
        "num_days": r.num_days,
        "remarks": r.remarks,
        "attachment": r.attachment_path,
        "status": r.status,
        "hr_comment": r.hr_comment,
        "created_at": r.created_at.strftime("%Y-%m-%d")
    } for r in records]

# Notification Endpoints
@app.get("/api/notifications")
def get_notifications(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    notifs = db.query(Notification).filter(
        Notification.employee_id == user.employee_id
    ).order_by(Notification.created_at.desc()).all()
    
    return [{
        "id": n.id,
        "message": n.message,
        "status": n.status,
        "link": n.link,
        "created_at": n.created_at.strftime("%Y-%m-%d %I:%M %p")
    } for n in notifs]

@app.post("/api/notifications/{n_id}/read")
def mark_notification_read(n_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    n = db.query(Notification).filter((Notification.id == n_id) & (Notification.employee_id == user.employee_id)).first()
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found.")
    n.status = "READ"
    db.commit()
    return {"message": "Notification marked as read."}

@app.post("/api/notifications/read-all")
def mark_all_read(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.query(Notification).filter(
        (Notification.employee_id == user.employee_id) & 
        (Notification.status == "UNREAD")
    ).update({Notification.status: "READ"}, synchronize_session=False)
    db.commit()
    return {"message": "All notifications marked as read."}

# ==========================================
# ADMIN & HR MANAGEMENT APIS
# ==========================================

class EmployeeCreateSchema(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    phone: Optional[str] = None
    address: Optional[str] = None
    designation: str
    department_id: int
    joining_date: str
    employment_type: str = "Full-Time"  # Full-Time, Part-Time, Intern, Contract
    work_mode: str = "OFFICE"  # OFFICE, WFH, HYBRID

class EmployeeUpdateSchema(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    phone: Optional[str] = None
    address: Optional[str] = None
    designation: str
    department_id: int
    employment_type: str
    work_mode: str

class PayrollUpdateSchema(BaseModel):
    basic_salary: float
    hra: float
    allowances: float
    pf: float
    professional_tax: float
    other_deductions: float

class DocumentVerifySchema(BaseModel):
    status: str  # APPROVED, REJECTED
    remarks: Optional[str] = None

class SettingsUpdateSchema(BaseModel):
    office_latitude: float
    office_longitude: float
    geofence_radius: float
    standard_work_hours: float

def get_current_admin(user: User = Depends(get_current_user)):
    if user.role not in ["ADMIN", "HR"]:
        raise HTTPException(status_code=403, detail="Access denied. Admin or HR privileges required.")
    return user

# 1. Company Settings APIs
@app.get("/api/admin/settings")
def get_admin_settings(admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    setting = db.query(CompanySetting).first()
    if not setting:
        setting = CompanySetting(
            office_latitude=OFFICE_LAT,
            office_longitude=OFFICE_LON,
            geofence_radius=ALLOWED_RADIUS,
            standard_work_hours=REQUIRED_HOURS
        )
        db.add(setting)
        db.commit()
    return {
        "office_latitude": setting.office_latitude,
        "office_longitude": setting.office_longitude,
        "geofence_radius": setting.geofence_radius,
        "standard_work_hours": setting.standard_work_hours
    }

@app.put("/api/admin/settings")
def update_admin_settings(req: SettingsUpdateSchema, admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    setting = db.query(CompanySetting).first()
    if not setting:
        setting = CompanySetting()
        db.add(setting)
    
    setting.office_latitude = req.office_latitude
    setting.office_longitude = req.office_longitude
    setting.geofence_radius = req.geofence_radius
    setting.standard_work_hours = req.standard_work_hours
    db.commit()
    
    # Update global variables in memory
    global OFFICE_LAT, OFFICE_LON, ALLOWED_RADIUS, REQUIRED_HOURS
    OFFICE_LAT = req.office_latitude
    OFFICE_LON = req.office_longitude
    ALLOWED_RADIUS = req.geofence_radius
    REQUIRED_HOURS = req.standard_work_hours
    
    return {"message": "Company settings updated successfully."}

# 2. Admin Dashboard Stats & Action Center API
@app.get("/api/admin/dashboard")
def get_admin_dashboard(admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    today = date.today()
    
    # Fetch total employees
    total_employees = db.query(Employee).count()
    
    # Fetch today's attendance records
    today_atts = db.query(Attendance).filter(Attendance.date == today).all()
    
    # Find employees currently on approved leave today
    leaves_today = db.query(LeaveRequest).filter(
        (LeaveRequest.status == "APPROVED") &
        (LeaveRequest.start_date <= today) &
        (LeaveRequest.end_date >= today)
    ).all()
    leave_employee_ids = {l.employee_id for l in leaves_today}
    
    present_count = sum(1 for r in today_atts if r.status in ["PRESENT", "COMPLETED"])
    incomplete_count = sum(1 for r in today_atts if r.status == "INCOMPLETE")
    leave_count = len(leave_employee_ids)
    
    # Rest are absent (excluding weekends)
    absent_count = 0
    if today.weekday() < 5:  # Mon to Fri
        checked_in_ids = {r.employee_id for r in today_atts}
        all_emps = db.query(Employee.employee_id).all()
        for (emp_id,) in all_emps:
            if emp_id != "EMP000" and emp_id not in checked_in_ids and emp_id not in leave_employee_ids:
                absent_count += 1
                
    # Action Center pending items
    pending_leaves = db.query(LeaveRequest).filter(LeaveRequest.status == "PENDING").count()
    pending_corrections = db.query(AttendanceCorrection).filter(AttendanceCorrection.status == "PENDING").count()
    pending_documents = db.query(Document).filter(Document.status == "PENDING").count()
    
    # Detect Exception Banner Alerts (like Odoo profile alerts)
    active_warnings = []
    employees = db.query(Employee).filter(Employee.employee_id != "EMP000").all()
    
    for emp in employees:
        emp_warnings = []
        # A. Missing Check-Outs (past dates in current month where checked in but not checked out)
        start_of_month = date(today.year, today.month, 1)
        missing_cos = db.query(Attendance).filter(
            (Attendance.employee_id == emp.employee_id) &
            (Attendance.date >= start_of_month) &
            (Attendance.date < today) &
            (Attendance.check_in_time != None) &
            (Attendance.check_out_time == None)
        ).count()
        if missing_cos > 0:
            emp_warnings.append(f"Has {missing_cos} missing checkout(s) this month")
            
        # B. Late check-ins count
        late_cis = 0
        atts_month = db.query(Attendance).filter(
            (Attendance.employee_id == emp.employee_id) &
            (Attendance.date >= start_of_month) &
            (Attendance.date <= today)
        ).all()
        for r in atts_month:
            if r.check_in_time:
                t = r.check_in_time.time()
                if t.hour > 9 or (t.hour == 9 and t.minute > 15):
                    late_cis += 1
        if late_cis >= 4:
            emp_warnings.append(f"Repeated Late Check-Ins ({late_cis} times this month)")
            
        # C. Consecutive Absences (check last 5 weekdays)
        # Search backward for attendance or leave
        consec_absences = 0
        curr_check = today - timedelta(days=1)
        while curr_check >= start_of_month and consec_absences < 3:
            if curr_check.weekday() < 5:  # Weekday
                has_att = db.query(Attendance).filter((Attendance.employee_id == emp.employee_id) & (Attendance.date == curr_check)).first()
                has_leave = db.query(LeaveRequest).filter(
                    (LeaveRequest.employee_id == emp.employee_id) &
                    (LeaveRequest.status == "APPROVED") &
                    (LeaveRequest.start_date <= curr_check) &
                    (LeaveRequest.end_date >= curr_check)
                ).first()
                if not has_att and not has_leave:
                    consec_absences += 1
                else:
                    break
            curr_check -= timedelta(days=1)
        if consec_absences >= 3:
            emp_warnings.append(f"Consecutive absences for {consec_absences} working days")
            
        if emp_warnings:
            active_warnings.append({
                "employee_id": emp.employee_id,
                "name": f"{emp.first_name} {emp.last_name}",
                "warnings": emp_warnings
            })
            
    return {
        "summary": {
            "total_employees": total_employees,
            "present": present_count,
            "absent": absent_count,
            "on_leave": leave_count,
            "incomplete": incomplete_count
        },
        "action_center": {
            "pending_leaves": pending_leaves,
            "pending_corrections": pending_corrections,
            "pending_documents": pending_documents,
            "total_actions": pending_leaves + pending_corrections + pending_documents
        },
        "warnings": active_warnings
    }

# 3. Employee Directory Management APIs
@app.get("/api/admin/employees")
def list_employees(admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    employees = db.query(Employee).all()
    result = []
    for emp in employees:
        user_rec = db.query(User).filter(User.employee_id == emp.employee_id).first()
        result.append({
            "employee_id": emp.employee_id,
            "first_name": emp.first_name,
            "last_name": emp.last_name,
            "email": emp.email,
            "phone": emp.phone,
            "address": emp.address,
            "designation": emp.designation,
            "department": emp.department.name,
            "joining_date": emp.joining_date.strftime("%Y-%m-%d"),
            "employment_type": emp.employment_type,
            "work_mode": emp.work_mode,
            "role": user_rec.role if user_rec else "EMPLOYEE"
        })
    return result

def generate_next_employee_id(db: Session) -> str:
    employees = db.query(Employee).all()
    if not employees:
        return "EMP001"
    ids = []
    for emp in employees:
        try:
            num = int(emp.employee_id.replace("EMP", ""))
            ids.append(num)
        except ValueError:
            pass
    next_id = max(ids) + 1 if ids else 1
    return f"EMP{next_id:03d}"

@app.post("/api/admin/employees")
def create_employee(
    first_name: str = Form(...),
    last_name: str = Form(...),
    email: str = Form(...),
    designation: str = Form(...),
    department_id: int = Form(...),
    joining_date: str = Form(...),
    employment_type: str = Form("Full-Time"),
    work_mode: str = Form("OFFICE"),
    phone: Optional[str] = Form(None),
    address: Optional[str] = Form(None),
    face_image: Optional[UploadFile] = File(None),
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    import cv2
    import time
    
    # Check if email is already taken in Users
    exist_user = db.query(User).filter(User.email == email).first()
    if exist_user:
        raise HTTPException(status_code=400, detail="An employee with this email already exists.")
        
    emp_id = generate_next_employee_id(db)
    
    # 1. Create User
    temp_pass = "Welcome@Dayflow2026"
    new_user = User(
        email=email,
        employee_id=emp_id,
        password_hash=hash_password(temp_pass),
        role="EMPLOYEE",
        temp_password_active=True
    )
    db.add(new_user)
    db.flush() # Generate relationships
    
    # Process face image if uploaded
    embedding = None
    profile_pic = None
    if face_image:
        # Save onboarding photo
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        filename = f"face_{emp_id}_{int(time.time())}{os.path.splitext(face_image.filename)[1]}"
        filepath = os.path.join(UPLOAD_DIR, filename)
        with open(filepath, "wb") as buffer:
            buffer.write(face_image.file.read())
            
        profile_pic = f"/uploads/{filename}"
        
        # Extract face embedding
        try:
            img = cv2.imread(filepath)
            if img is not None:
                face_emb = face_verifier.get_face_embedding(img)
                if face_emb is not None:
                    # Convert numpy array to list of floats for JSON serialization
                    embedding = face_emb.tolist()
        except Exception as e:
            print("Failed to extract face embedding:", e)
            
    # 2. Create Employee Profile
    j_date = datetime.strptime(joining_date, "%Y-%m-%d").date()
    new_emp = Employee(
        employee_id=emp_id,
        first_name=first_name,
        last_name=last_name,
        email=email,
        phone=phone,
        address=address,
        designation=designation,
        department_id=department_id,
        joining_date=j_date,
        employment_type=employment_type,
        work_mode=work_mode,
        registered_face_embedding=embedding,
        profile_picture_path=profile_pic
    )
    db.add(new_emp)
    
    # 3. Create Default Leave Balance
    balance = LeaveBalance(
        employee_id=emp_id,
        paid_leave=15.0,
        sick_leave=10.0,
        unpaid_leave=0.0
    )
    db.add(balance)
    
    # 4. Create Default Payroll Contract
    payroll = Payroll(
        employee_id=emp_id,
        basic_salary=0.0,
        hra=0.0,
        allowances=0.0,
        pf=0.0,
        professional_tax=0.0,
        other_deductions=0.0,
        gross_salary=0.0,
        net_salary=0.0
    )
    db.add(payroll)
    
    # 5. Create Welcome Notification
    msg = f"Welcome to Dayflow, {first_name}! Your temporary password is '{temp_pass}'."
    if embedding:
        msg += " Your face recognition identity has been pre-registered by HR. You can check-in immediately!"
    else:
        msg += " Please log in and enroll your face identity."
        
    notif = Notification(
        employee_id=emp_id,
        message=msg,
        status="UNREAD",
        link="/profile"
    )
    db.add(notif)
    
    db.commit()
    return {"message": "Employee created successfully!", "employee_id": emp_id, "temporary_password": temp_pass}

@app.put("/api/admin/employees/{employee_id}")
def update_employee(employee_id: str, req: EmployeeUpdateSchema, admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    emp = db.query(Employee).filter(Employee.employee_id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found.")
        
    user_rec = db.query(User).filter(User.employee_id == employee_id).first()
    
    # Check email duplicate
    if emp.email != req.email:
        exist = db.query(User).filter(User.email == req.email).first()
        if exist:
            raise HTTPException(status_code=400, detail="This email is already in use by another account.")
            
    emp.first_name = req.first_name
    emp.last_name = req.last_name
    emp.email = req.email
    emp.phone = req.phone
    emp.address = req.address
    emp.designation = req.designation
    emp.department_id = req.department_id
    emp.employment_type = req.employment_type
    emp.work_mode = req.work_mode
    
    if user_rec:
        user_rec.email = req.email
        
    db.commit()
    return {"message": "Employee details updated successfully."}

@app.delete("/api/admin/employees/{employee_id}")
def delete_employee(employee_id: str, admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    emp = db.query(Employee).filter(Employee.employee_id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found.")
    if employee_id == "EMP000":
        raise HTTPException(status_code=400, detail="Cannot delete the master System Admin.")
        
    user_rec = db.query(User).filter(User.employee_id == employee_id).first()
    if user_rec:
        db.delete(user_rec)
        
    db.delete(emp)
    db.commit()
    return {"message": "Employee deleted successfully."}

# 4. Attendance Logs list API
@app.get("/api/admin/attendance")
def list_attendance_logs(date_filter: Optional[str] = None, user_filter: Optional[str] = None, admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    query = db.query(Attendance)
    
    if date_filter:
        try:
            d_val = datetime.strptime(date_filter, "%Y-%m-%d").date()
            query = query.filter(Attendance.date == d_val)
        except ValueError:
            pass
            
    if user_filter:
        query = query.filter((Attendance.employee_id == user_filter) | (Attendance.employee_id.like(f"%{user_filter}%")))
        
    records = query.order_by(Attendance.date.desc(), Attendance.check_in_time.desc()).all()
    result = []
    
    for r in records:
        emp = db.query(Employee).filter(Employee.employee_id == r.employee_id).first()
        name_str = f"{emp.first_name} {emp.last_name}" if emp else "Unknown"
        result.append({
            "id": r.id,
            "employee_id": r.employee_id,
            "name": name_str,
            "date": r.date.strftime("%Y-%m-%d"),
            "work_mode": r.work_mode,
            "check_in": r.check_in_time.strftime("%I:%M %p") if r.check_in_time else "--",
            "check_out": r.check_out_time.strftime("%I:%M %p") if r.check_out_time else "--",
            "work_hours": r.work_hours,
            "status": r.status,
            "face_verified": r.face_verified,
            "location_verified": r.location_verified
        })
    return result

# 5. Attendance Correction API
@app.get("/api/admin/corrections")
def list_admin_corrections(admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    records = db.query(AttendanceCorrection).order_by(AttendanceCorrection.created_at.desc()).all()
    result = []
    for r in records:
        emp = db.query(Employee).filter(Employee.employee_id == r.employee_id).first()
        name_str = f"{emp.first_name} {emp.last_name}" if emp else "Unknown"
        result.append({
            "id": r.id,
            "employee_id": r.employee_id,
            "name": name_str,
            "attendance_date": r.attendance_date.strftime("%Y-%m-%d"),
            "issue_type": r.issue_type,
            "requested_time": r.requested_time,
            "reason": r.reason,
            "status": r.status,
            "created_at": r.created_at.strftime("%Y-%m-%d")
        })
    return result

@app.post("/api/admin/corrections/{corr_id}/approve")
def approve_correction(corr_id: int, admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    corr = db.query(AttendanceCorrection).filter(AttendanceCorrection.id == corr_id).first()
    if not corr:
        raise HTTPException(status_code=404, detail="Correction request not found.")
    if corr.status != "PENDING":
        raise HTTPException(status_code=400, detail="Correction request is already processed.")
        
    # Find or create corresponding attendance record
    att = db.query(Attendance).filter(
        (Attendance.employee_id == corr.employee_id) & 
        (Attendance.date == corr.attendance_date)
    ).first()
    
    # Parse requested time (e.g. "09:00 AM" or "06:00 PM")
    try:
        t_parsed = datetime.strptime(corr.requested_time, "%I:%M %p").time()
        combined_dt = datetime.combine(corr.attendance_date, t_parsed)
    except ValueError:
        # Fallback to standard 24h format
        try:
            t_parsed = datetime.strptime(corr.requested_time, "%H:%M").time()
            combined_dt = datetime.combine(corr.attendance_date, t_parsed)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Cannot parse requested time: '{corr.requested_time}'")
            
    if not att:
        emp = db.query(Employee).filter(Employee.employee_id == corr.employee_id).first()
        att = Attendance(
            employee_id=corr.employee_id,
            date=corr.attendance_date,
            work_mode=emp.work_mode if emp else "OFFICE",
            status="INCOMPLETE"
        )
        db.add(att)
        
    if "check-in" in corr.issue_type.lower() or "check_in" in corr.issue_type.lower() or "forgot check-in" in corr.issue_type.lower():
        att.check_in_time = combined_dt
    else:
        att.check_out_time = combined_dt
        
    # Recompute hours and status if both are set
    if att.check_in_time and att.check_out_time:
        delta = att.check_out_time - att.check_in_time
        work_hrs = max(0.0, delta.total_seconds() / 3600.0)
        extra_hrs = max(0.0, work_hrs - REQUIRED_HOURS)
        att.work_hours = round(work_hrs, 2)
        att.extra_hours = round(extra_hrs, 2)
        
        if work_hrs >= REQUIRED_HOURS:
            att.status = "PRESENT"
        elif work_hrs >= (REQUIRED_HOURS / 2.0):
            att.status = "HALF_DAY"
        else:
            att.status = "INCOMPLETE"
            
    corr.status = "APPROVED"
    
    # Notify employee
    notif = Notification(
        employee_id=corr.employee_id,
        message=f"Your attendance correction request for {corr.attendance_date.strftime('%Y-%m-%d')} has been APPROVED.",
        status="UNREAD",
        link="/attendance"
    )
    db.add(notif)
    
    db.commit()
    return {"message": "Attendance correction approved successfully."}

@app.post("/api/admin/corrections/{corr_id}/reject")
def reject_correction(corr_id: int, req: DocumentVerifySchema, admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    corr = db.query(AttendanceCorrection).filter(AttendanceCorrection.id == corr_id).first()
    if not corr:
        raise HTTPException(status_code=404, detail="Correction request not found.")
    if corr.status != "PENDING":
        raise HTTPException(status_code=400, detail="Correction request is already processed.")
        
    corr.status = "REJECTED"
    
    # Notify employee
    msg = f"Your attendance correction request for {corr.attendance_date.strftime('%Y-%m-%d')} was REJECTED."
    if req.remarks:
        msg += f" Reason: {req.remarks}"
        
    notif = Notification(
        employee_id=corr.employee_id,
        message=msg,
        status="UNREAD",
        link="/attendance"
    )
    db.add(notif)
    
    db.commit()
    return {"message": "Attendance correction rejected."}

# 6. Leaves Approvals APIs
@app.get("/api/admin/leaves")
def list_admin_leaves(admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    records = db.query(LeaveRequest).order_by(LeaveRequest.created_at.desc()).all()
    result = []
    for r in records:
        emp = db.query(Employee).filter(Employee.employee_id == r.employee_id).first()
        name_str = f"{emp.first_name} {emp.last_name}" if emp else "Unknown"
        result.append({
            "id": r.id,
            "employee_id": r.employee_id,
            "name": name_str,
            "leave_type": r.leave_type,
            "start_date": r.start_date.strftime("%Y-%m-%d"),
            "end_date": r.end_date.strftime("%Y-%m-%d"),
            "num_days": r.num_days,
            "remarks": r.remarks,
            "attachment": r.attachment_path,
            "status": r.status,
            "hr_comment": r.hr_comment,
            "created_at": r.created_at.strftime("%Y-%m-%d")
        })
    return result

@app.post("/api/admin/leaves/{leave_id}/approve")
def approve_leave(leave_id: int, admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    l_req = db.query(LeaveRequest).filter(LeaveRequest.id == leave_id).first()
    if not l_req:
        raise HTTPException(status_code=404, detail="Leave request not found.")
    if l_req.status != "PENDING":
        raise HTTPException(status_code=400, detail="Leave request already processed.")
        
    # Check and deduct balance
    bal = db.query(LeaveBalance).filter(LeaveBalance.employee_id == l_req.employee_id).first()
    if not bal:
        bal = LeaveBalance(employee_id=l_req.employee_id)
        db.add(bal)
        
    num_days = l_req.num_days
    if l_req.leave_type == "Paid Leave":
        if bal.paid_leave < num_days:
            raise HTTPException(status_code=400, detail=f"Insufficient Paid Leave balance. Employee has {bal.paid_leave} left.")
        bal.paid_leave -= num_days
    elif l_req.leave_type == "Sick Leave":
        if bal.sick_leave < num_days:
            raise HTTPException(status_code=400, detail=f"Insufficient Sick Leave balance. Employee has {bal.sick_leave} left.")
        bal.sick_leave -= num_days
    else:
        bal.unpaid_leave += num_days
        
    l_req.status = "APPROVED"
    
    # Mark days on attendance calendar as LEAVE
    curr = l_req.start_date
    while curr <= l_req.end_date:
        if curr.weekday() < 5:  # Ignore weekends
            att = db.query(Attendance).filter((Attendance.employee_id == l_req.employee_id) & (Attendance.date == curr)).first()
            if not att:
                att = Attendance(
                    employee_id=l_req.employee_id,
                    date=curr,
                    work_mode="WFH",  # Default placeholder
                )
                db.add(att)
            att.status = "LEAVE"
        curr += timedelta(days=1)
        
    # Notify employee
    notif = Notification(
        employee_id=l_req.employee_id,
        message=f"Your leave request from {l_req.start_date.strftime('%Y-%m-%d')} to {l_req.end_date.strftime('%Y-%m-%d')} has been APPROVED.",
        status="UNREAD",
        link="/timeoff"
    )
    db.add(notif)
    
    db.commit()
    return {"message": "Leave request approved successfully."}

@app.post("/api/admin/leaves/{leave_id}/reject")
def reject_leave(leave_id: int, req: DocumentVerifySchema, admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    l_req = db.query(LeaveRequest).filter(LeaveRequest.id == leave_id).first()
    if not l_req:
        raise HTTPException(status_code=404, detail="Leave request not found.")
    if l_req.status != "PENDING":
        raise HTTPException(status_code=400, detail="Leave request already processed.")
        
    l_req.status = "REJECTED"
    l_req.hr_comment = req.remarks
    
    # Notify employee
    msg = f"Your leave request from {l_req.start_date.strftime('%Y-%m-%d')} to {l_req.end_date.strftime('%Y-%m-%d')} was REJECTED."
    if req.remarks:
        msg += f" Remarks: {req.remarks}"
        
    notif = Notification(
        employee_id=l_req.employee_id,
        message=msg,
        status="UNREAD",
        link="/timeoff"
    )
    db.add(notif)
    
    db.commit()
    return {"message": "Leave request rejected."}

@app.get("/api/admin/team-availability")
def get_admin_team_availability(start_date: str, end_date: str, admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    try:
        s_date = datetime.strptime(start_date, "%Y-%m-%d").date()
        e_date = datetime.strptime(end_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")
        
    # Get all active approved leaves in this range
    leaves = db.query(LeaveRequest).filter(
        (LeaveRequest.status == "APPROVED") &
        (LeaveRequest.start_date <= e_date) &
        (LeaveRequest.end_date >= s_date)
    ).all()
    
    result = []
    for l in leaves:
        emp = db.query(Employee).filter(Employee.employee_id == l.employee_id).first()
        if emp:
            result.append({
                "employee_id": emp.employee_id,
                "name": f"{emp.first_name} {emp.last_name}",
                "department": emp.department.name,
                "start_date": l.start_date.strftime("%Y-%m-%d"),
                "end_date": l.end_date.strftime("%Y-%m-%d")
            })
    return result

# 7. Payroll APIs
@app.get("/api/admin/payroll")
def list_admin_payroll(admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    contracts = db.query(Payroll).all()
    result = []
    for c in contracts:
        emp = db.query(Employee).filter(Employee.employee_id == c.employee_id).first()
        name_str = f"{emp.first_name} {emp.last_name}" if emp else "Unknown"
        result.append({
            "employee_id": c.employee_id,
            "name": name_str,
            "basic_salary": c.basic_salary,
            "hra": c.hra,
            "allowances": c.allowances,
            "pf": c.pf,
            "professional_tax": c.professional_tax,
            "other_deductions": c.other_deductions,
            "gross_salary": c.gross_salary,
            "net_salary": c.net_salary
        })
    return result

@app.put("/api/admin/payroll/{employee_id}")
def update_payroll(employee_id: str, req: PayrollUpdateSchema, admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    c = db.query(Payroll).filter(Payroll.employee_id == employee_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Payroll contract not found.")
        
    c.basic_salary = req.basic_salary
    c.hra = req.hra
    c.allowances = req.allowances
    c.pf = req.pf
    c.professional_tax = req.professional_tax
    c.other_deductions = req.other_deductions
    
    # Calculate Gross and Net Salary automatically
    c.gross_salary = round(req.basic_salary + req.hra + req.allowances, 2)
    c.net_salary = round(c.gross_salary - (req.pf + req.professional_tax + req.other_deductions), 2)
    
    db.commit()
    return {"message": "Payroll details updated successfully.", "gross_salary": c.gross_salary, "net_salary": c.net_salary}

# 8. Document Verification APIs
@app.get("/api/admin/documents")
def list_admin_documents(admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    docs = db.query(Document).order_by(Document.uploaded_at.desc()).all()
    result = []
    for d in docs:
        emp = db.query(Employee).filter(Employee.employee_id == d.employee_id).first()
        name_str = f"{emp.first_name} {emp.last_name}" if emp else "Unknown"
        result.append({
            "id": d.id,
            "employee_id": d.employee_id,
            "employee_name": name_str,
            "name": d.name,
            "type": d.type,
            "path": f"/uploads/{os.path.basename(d.file_path)}",
            "status": d.status,
            "remarks": d.remarks,
            "uploaded_at": d.uploaded_at.strftime("%Y-%m-%d")
        })
    return result

@app.post("/api/admin/documents/{doc_id}/verify")
def verify_document(doc_id: int, req: DocumentVerifySchema, admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
        
    doc.status = req.status
    doc.remarks = req.remarks
    
    # Notify employee
    msg = f"Your uploaded document '{doc.name}' ({doc.type}) has been {doc.status} by HR."
    if req.remarks:
        msg += f" Remarks: {req.remarks}"
        
    notif = Notification(
        employee_id=doc.employee_id,
        message=msg,
        status="UNREAD",
        link="/profile"
    )
    db.add(notif)
    
    db.commit()
    return {"message": f"Document status updated to '{doc.status}'."}

