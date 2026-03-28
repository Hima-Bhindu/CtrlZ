import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "phantom.db")

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            username TEXT PRIMARY KEY,
            key_hash TEXT NOT NULL,
            security_answer_hash TEXT NOT NULL
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS files (
            id TEXT PRIMARY KEY,
            filename TEXT NOT NULL,
            filepath TEXT NOT NULL,
            owner_username TEXT NOT NULL,
            expiry_time INTEGER NOT NULL,
            ai_caption TEXT NOT NULL,
            original_path TEXT NOT NULL
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_id TEXT NOT NULL,
            filename TEXT NOT NULL,
            action TEXT NOT NULL,
            timestamp INTEGER NOT NULL,
            owner_username TEXT NOT NULL
        )
    ''')
    conn.commit()
    conn.close()

def get_connection():
    return sqlite3.connect(DB_PATH)
