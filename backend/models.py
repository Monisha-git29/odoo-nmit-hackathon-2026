from sqlalchemy import Column, Integer, String, Boolean, DateTime, Date, Float, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(100), unique=True, index=True, nullable=False)
    employee_id = Column(String(50), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), default="EMPLOYEE", nullable=False)  # EMPLOYEE, ADMIN, HR
    temp_password_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    employee = relationship("Employee", back_populates="user", uselist=False)

class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    code = Column(String(20), unique=True, nullable=False)

    # Relationships
    employees = relationship("Employee", back_populates="department")

class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(String(50), ForeignKey("users.employee_id", ondelete="CASCADE"), unique=True, nullable=False)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(100), nullable=False)
    phone = Column(String(20), nullable=True)
    address = Column(String(255), nullable=True)
    date_of_birth = Column(Date, nullable=True)
    gender = Column(String(20), nullable=True)
    designation = Column(String(100), nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    joining_date = Column(Date, nullable=False)
    employment_type = Column(String(50), default="Full-Time")  # Full-Time, Part-Time, Intern, Contract
    work_mode = Column(String(20), default="OFFICE")  # OFFICE, WFH, HYBRID
    registered_face_embedding = Column(JSON, nullable=True)  # Stores [x1, x2, ..., x128]
    resume_path = Column(String(255), nullable=True)
    profile_picture_path = Column(String(255), nullable=True)

    # Relationships
    user = relationship("User", back_populates="employee")
    department = relationship("Department", back_populates="employees")
    attendance_records = relationship("Attendance", back_populates="employee", cascade="all, delete-orphan")
    leave_requests = relationship("LeaveRequest", back_populates="employee", cascade="all, delete-orphan")
    leave_balance = relationship("LeaveBalance", back_populates="employee", uselist=False, cascade="all, delete-orphan")
    payroll = relationship("Payroll", back_populates="employee", uselist=False, cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="employee", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="employee", cascade="all, delete-orphan")
    corrections = relationship("AttendanceCorrection", back_populates="employee", cascade="all, delete-orphan")
    schedules = relationship("EmployeeWorkSchedule", back_populates="employee", cascade="all, delete-orphan")

class Attendance(Base):
    __tablename__ = "attendance"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(String(50), ForeignKey("employees.employee_id", ondelete="CASCADE"), nullable=False)
    date = Column(Date, index=True, nullable=False)
    work_mode = Column(String(20), nullable=False)  # OFFICE, WFH
    check_in_time = Column(DateTime, nullable=True)
    check_out_time = Column(DateTime, nullable=True)
    work_hours = Column(Float, default=0.0)
    extra_hours = Column(Float, default=0.0)
    status = Column(String(30), default="NOT_CHECKED_IN", nullable=False)  # NOT_CHECKED_IN, CHECKED_IN, COMPLETED, PRESENT, HALF_DAY, ABSENT, LEAVE, INCOMPLETE
    face_verified = Column(Boolean, default=False)
    location_verified = Column(Boolean, default=False)

    employee = relationship("Employee", back_populates="attendance_records")

class AttendanceCorrection(Base):
    __tablename__ = "attendance_corrections"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(String(50), ForeignKey("employees.employee_id", ondelete="CASCADE"), nullable=False)
    attendance_date = Column(Date, nullable=False)
    issue_type = Column(String(50), nullable=False)  # Forgot Check-In, Forgot Check-Out, Incorrect Attendance Time
    requested_time = Column(String(100), nullable=False)  # e.g., "09:00 AM" or "06:00 PM"
    reason = Column(Text, nullable=False)
    status = Column(String(20), default="PENDING", nullable=False)  # PENDING, APPROVED, REJECTED
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    employee = relationship("Employee", back_populates="corrections")

class LeaveBalance(Base):
    __tablename__ = "leave_balances"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(String(50), ForeignKey("employees.employee_id", ondelete="CASCADE"), unique=True, nullable=False)
    paid_leave = Column(Float, default=15.0, nullable=False)
    sick_leave = Column(Float, default=10.0, nullable=False)
    unpaid_leave = Column(Float, default=0.0, nullable=False)

    employee = relationship("Employee", back_populates="leave_balance")

class LeaveRequest(Base):
    __tablename__ = "leave_requests"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(String(50), ForeignKey("employees.employee_id", ondelete="CASCADE"), nullable=False)
    leave_type = Column(String(50), nullable=False)  # Paid Leave, Sick Leave, Unpaid Leave
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    num_days = Column(Float, nullable=False)
    remarks = Column(Text, nullable=True)
    attachment_path = Column(String(255), nullable=True)
    status = Column(String(20), default="PENDING", nullable=False)  # PENDING, APPROVED, REJECTED
    hr_comment = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    employee = relationship("Employee", back_populates="leave_requests")

class EmployeeWorkSchedule(Base):
    __tablename__ = "employee_work_schedule"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(String(50), ForeignKey("employees.employee_id", ondelete="CASCADE"), nullable=False)
    date = Column(Date, nullable=False)
    work_mode = Column(String(20), nullable=False)  # OFFICE, WFH

    employee = relationship("Employee", back_populates="schedules")

class Payroll(Base):
    __tablename__ = "payroll"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(String(50), ForeignKey("employees.employee_id", ondelete="CASCADE"), unique=True, nullable=False)
    basic_salary = Column(Float, default=0.0, nullable=False)
    hra = Column(Float, default=0.0, nullable=False)
    allowances = Column(Float, default=0.0, nullable=False)
    pf = Column(Float, default=0.0, nullable=False)
    professional_tax = Column(Float, default=0.0, nullable=False)
    other_deductions = Column(Float, default=0.0, nullable=False)
    gross_salary = Column(Float, default=0.0, nullable=False)
    net_salary = Column(Float, default=0.0, nullable=False)

    employee = relationship("Employee", back_populates="payroll")

class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(String(50), ForeignKey("employees.employee_id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    type = Column(String(50), nullable=False)  # RESUME, CERTIFICATE
    file_path = Column(String(255), nullable=False)
    status = Column(String(20), default="PENDING", nullable=False)  # PENDING, APPROVED, REJECTED
    remarks = Column(String(255), nullable=True)
    uploaded_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    employee = relationship("Employee", back_populates="documents")

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(String(50), ForeignKey("employees.employee_id", ondelete="CASCADE"), nullable=False)
    message = Column(String(255), nullable=False)
    status = Column(String(20), default="UNREAD", nullable=False)  # UNREAD, READ
    link = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    employee = relationship("Employee", back_populates="notifications")

class CompanySetting(Base):
    __tablename__ = "company_settings"

    id = Column(Integer, primary_key=True, index=True)
    office_latitude = Column(Float, default=12.9716, nullable=False)
    office_longitude = Column(Float, default=77.5946, nullable=False)
    geofence_radius = Column(Float, default=100.0, nullable=False)
    standard_work_hours = Column(Float, default=8.0, nullable=False)
