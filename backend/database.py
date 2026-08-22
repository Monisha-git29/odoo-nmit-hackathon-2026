import os
import urllib.parse
import pymysql
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "mysql+pymysql://root:@localhost:3306/dayflow_db")

# Parse DATABASE_URL to create database if not exists
try:
    parsed = urllib.parse.urlsplit(DATABASE_URL)
    # Extract host, port, user, password
    db_name = parsed.path.lstrip('/')
    
    # Connect using pymysql to verify and create DB if needed
    conn = pymysql.connect(
        host=parsed.hostname or "localhost",
        port=parsed.port or 3306,
        user=parsed.username or "root",
        password=parsed.password or "",
        connect_timeout=3
    )
    with conn.cursor() as cursor:
        cursor.execute(f"CREATE DATABASE IF NOT EXISTS {db_name}")
    conn.close()
    print(f"Database verified/created: {db_name}")
except Exception as e:
    print(f"Warning: Failed to ensure database exists: {e}")

engine = create_engine(DATABASE_URL, pool_recycle=3600, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
