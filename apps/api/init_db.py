"""
Database initialization module for first-time setup.
This module handles creating tables and seeding initial data.
"""
import logging
import time
from sqlalchemy import text, create_engine
from sqlalchemy.orm import sessionmaker
from database import engine, SessionLocal
from models import Base, Framework
from seed_data import seed_essential_eight

logger = logging.getLogger(__name__)

def wait_for_database(max_retries=30, retry_delay=2):
    """Wait for database to be available."""
    for attempt in range(max_retries):
        try:
            # Try to connect to the database
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            logger.info("Database connection established")
            return True
        except Exception as e:
            logger.warning(f"Database connection attempt {attempt + 1}/{max_retries} failed: {e}")
            if attempt < max_retries - 1:
                time.sleep(retry_delay)
            continue
    
    logger.error("Failed to connect to database after maximum retries")
    return False

def create_tables():
    """Create all database tables."""
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables created successfully")
        return True
    except Exception as e:
        logger.error(f"Error creating tables: {e}")
        return False

def check_if_seeded():
    """Check if the database has been seeded with initial data."""
    try:
        db = SessionLocal()
        framework_count = db.query(Framework).count()
        db.close()
        return framework_count > 0
    except Exception as e:
        logger.warning(f"Error checking seeded status: {e}")
        return False

def run_initial_seed():
    """Run initial database seeding."""
    try:
        db = SessionLocal()
        
        # Check if Essential Eight framework already exists
        existing = db.query(Framework).filter(Framework.name == "Essential Eight").first()
        if existing:
            logger.info("Essential Eight framework already exists, skipping seed")
            db.close()
            return True
        
        # Seed the Essential Eight framework
        logger.info("Seeding Essential Eight framework...")
        framework_id = seed_essential_eight(db)
        logger.info(f"Essential Eight framework seeded successfully with ID: {framework_id}")
        
        db.close()
        return True
        
    except Exception as e:
        logger.error(f"Error during database seeding: {e}")
        try:
            db.rollback()
            db.close()
        except:
            pass
        return False

def initialize_database():
    """
    Main database initialization function.
    Called on application startup to ensure database is ready.
    """
    logger.info("Starting database initialization...")
    
    # Wait for database to be available
    if not wait_for_database():
        logger.error("Database is not available, cannot continue")
        return False
    
    # Create tables if they don't exist
    if not create_tables():
        logger.error("Failed to create database tables")
        return False
    
    # Check if database needs seeding
    if not check_if_seeded():
        logger.info("Database appears to be empty, running initial seed...")
        if not run_initial_seed():
            logger.error("Failed to seed initial data")
            return False
    else:
        logger.info("Database already contains data, skipping seed")
    
    logger.info("Database initialization completed successfully")
    return True

if __name__ == "__main__":
    # Configure logging for standalone execution
    logging.basicConfig(level=logging.INFO)
    
    if initialize_database():
        print("Database initialization completed successfully!")
    else:
        print("Database initialization failed!")
        exit(1)