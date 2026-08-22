import os
import bcrypt
from datetime import datetime, date, timedelta
from database import engine, SessionLocal, Base
from models import User, Employee, Department, LeaveBalance, Payroll, Notification, EmployeeWorkSchedule

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def seed_db():
    # Create all tables in the database
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        # Check if departments already exist
        if db.query(Department).first():
            print("Database already seeded.")
            return

        print("Seeding departments...")
        eng = Department(name="Engineering", code="ENG")
        hr_dept = Department(name="Human Resources", code="HR")
        mkt = Department(name="Marketing", code="MKT")
        db.add_all([eng, hr_dept, mkt])
        db.commit()

        print("Seeding users and employees...")
        # 1. Admin/HR User
        admin_user = User(
            email="admin@dayflow.com",
            employee_id="EMP000",
            password_hash=hash_password("admin123"),
            role="ADMIN",
            temp_password_active=False
        )
        db.add(admin_user)
        db.flush() # Populate ID

        admin_emp = Employee(
            employee_id="EMP000",
            first_name="Admin",
            last_name="HR",
            email="admin@dayflow.com",
            phone="+919876543210",
            address="Dayflow Headquarters, Bangalore",
            date_of_birth=date(1990, 5, 15),
            gender="Female",
            designation="HR Manager",
            department_id=hr_dept.id,
            joining_date=date(2025, 1, 1),
            employment_type="Full-Time",
            work_mode="OFFICE"
        )
        db.add(admin_emp)

        # 2. Regular Employee (Office)
        emp1_user = User(
            email="employee@dayflow.com",
            employee_id="EMP001",
            password_hash=hash_password("temp123"), # Temporary password
            role="EMPLOYEE",
            temp_password_active=True
        )
        db.add(emp1_user)
        db.flush()

        emp1 = Employee(
            employee_id="EMP001",
            first_name="John",
            last_name="Doe",
            email="employee@dayflow.com",
            phone="+919988776655",
            address="123, Green Glen Layout, Bellandur, Bangalore",
            date_of_birth=date(1995, 8, 22),
            gender="Male",
            designation="Software Engineer",
            department_id=eng.id,
            joining_date=date(2026, 1, 15),
            employment_type="Full-Time",
            work_mode="OFFICE"
        )
        db.add(emp1)

        # 3. Hybrid Employee
        emp2_user = User(
            email="hybrid@dayflow.com",
            employee_id="EMP002",
            password_hash=hash_password("temp123"),
            role="EMPLOYEE",
            temp_password_active=True
        )
        db.add(emp2_user)
        db.flush()

        emp2 = Employee(
            employee_id="EMP002",
            first_name="Sarah",
            last_name="Smith",
            email="hybrid@dayflow.com",
            phone="+919944332211",
            address="456, HSR Layout, Sector 3, Bangalore",
            date_of_birth=date(1997, 12, 10),
            gender="Female",
            designation="UI/UX Designer",
            department_id=eng.id,
            joining_date=date(2026, 3, 1),
            employment_type="Full-Time",
            work_mode="HYBRID"
        )
        db.add(emp2)

        # 4. WFH Employee
        emp3_user = User(
            email="wfh@dayflow.com",
            employee_id="EMP003",
            password_hash=hash_password("temp123"),
            role="EMPLOYEE",
            temp_password_active=True
        )
        db.add(emp3_user)
        db.flush()

        emp3 = Employee(
            employee_id="EMP003",
            first_name="David",
            last_name="Lee",
            email="wfh@dayflow.com",
            phone="+919845123456",
            address="E-City Phase 1, Electronic City, Bangalore",
            date_of_birth=date(1994, 3, 5),
            gender="Male",
            designation="QA Engineer",
            department_id=eng.id,
            joining_date=date(2026, 5, 20),
            employment_type="Contract",
            work_mode="WFH"
        )
        db.add(emp3)

        # Commit Users & Employees
        db.commit()

        print("Seeding Leave Balances...")
        # Add Leave balances
        for emp_id in ["EMP001", "EMP002", "EMP003"]:
            balance = LeaveBalance(
                employee_id=emp_id,
                paid_leave=15.0,
                sick_leave=10.0,
                unpaid_leave=0.0
            )
            db.add(balance)
        db.commit()

        print("Seeding Payroll (Salary details)...")
        # Add Salaries
        salary1 = Payroll(
            employee_id="EMP001",
            basic_salary=45000.0,
            hra=18000.0,
            allowances=12000.0,
            pf=5400.0,
            professional_tax=200.0,
            other_deductions=1400.0,
            gross_salary=75000.0,
            net_salary=68000.0
        )
        salary2 = Payroll(
            employee_id="EMP002",
            basic_salary=42000.0,
            hra=16800.0,
            allowances=11200.0,
            pf=5040.0,
            professional_tax=200.0,
            other_deductions=1760.0,
            gross_salary=70000.0,
            net_salary=63000.0
        )
        salary3 = Payroll(
            employee_id="EMP003",
            basic_salary=30000.0,
            hra=12000.0,
            allowances=8000.0,
            pf=3600.0,
            professional_tax=200.0,
            other_deductions=1200.0,
            gross_salary=50000.0,
            net_salary=45000.0
        )
        db.add_all([salary1, salary2, salary3])
        db.commit()

        print("Seeding Hybrid Work Schedule for Sarah (EMP002)...")
        # Seed schedules for EMP002 for the current month/period (next 30 days from 2026-08-20)
        start_date = date(2026, 8, 1)
        for i in range(45):
            curr_date = start_date + timedelta(days=i)
            # Skip weekends (Saturday=5, Sunday=6)
            if curr_date.weekday() >= 5:
                continue
            
            # WFH on Mon/Wed/Fri, OFFICE on Tue/Thu
            # Mon=0, Tue=1, Wed=2, Thu=3, Fri=4
            w_mode = "WFH" if curr_date.weekday() in [0, 2, 4] else "OFFICE"
            
            schedule = EmployeeWorkSchedule(
                employee_id="EMP002",
                date=curr_date,
                work_mode=w_mode
            )
            db.add(schedule)
        db.commit()

        print("Seeding notifications...")
        for emp_id in ["EMP001", "EMP002", "EMP003"]:
            notif = Notification(
                employee_id=emp_id,
                message="Welcome to Dayflow! Please enroll your face identity to mark attendance.",
                status="UNREAD",
                link="/profile"
            )
            db.add(notif)
        db.commit()

        print("Seeding completed successfully.")

    except Exception as e:
        db.rollback()
        print(f"Error during seeding: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    seed_db()
