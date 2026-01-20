#!/usr/bin/env python3
import sqlite3
import os

DB_PATH = "ZimFeast/db.sqlite3"

def view_database():
    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}")
        return
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;")
    tables = cursor.fetchall()
    
    print("=" * 80)
    print(f"DATABASE: {DB_PATH}")
    print("=" * 80)
    
    for (table_name,) in tables:
        if table_name.startswith('sqlite_'):
            continue
            
        print(f"\n{'='*80}")
        print(f"TABLE: {table_name}")
        print("=" * 80)
        
        cursor.execute(f"PRAGMA table_info({table_name});")
        columns = cursor.fetchall()
        col_names = [col[1] for col in columns]
        print(f"Columns: {', '.join(col_names)}")
        print("-" * 80)
        
        cursor.execute(f"SELECT * FROM {table_name};")
        rows = cursor.fetchall()
        
        if not rows:
            print("(empty table)")
        else:
            print(f"Row count: {len(rows)}")
            print("-" * 80)
            for row in rows:
                print(row)
    
    conn.close()
    print("\n" + "=" * 80)
    print("END OF DATABASE DUMP")
    print("=" * 80)

if __name__ == "__main__":
    view_database()
