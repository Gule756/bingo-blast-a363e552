#!/usr/bin/env python3
"""
Migration Script: SQLite to Supabase
Moves all users from SQLite database to Supabase PostgreSQL
"""

import sqlite3
import asyncio
import os
from datetime import datetime
from dotenv import load_dotenv
import asyncpg
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select, update
from uuid import uuid4

# Load environment
load_dotenv()

# Database configurations
SQLITE_DB = "habesha_bingo_complete.db"
SUPABASE_URL = os.getenv("DATABASE_URL")  # Should be your Supabase connection string

async def migrate_users_to_supabase():
    """Migrate all users from SQLite to Supabase"""
    print("Starting migration from SQLite to Supabase...")
    print("=" * 50)
    
    # Step 1: Connect to SQLite and get all users
    print("Step 1: Reading users from SQLite...")
    try:
        sqlite_conn = sqlite3.connect(SQLITE_DB)
        sqlite_conn.row_factory = sqlite3.Row
        cursor = sqlite_conn.cursor()
        
        cursor.execute("""
            SELECT user_id, username, phone_number, deposited_balance, won_balance,
                   bonus_claimed, referral_count, referrer_id, is_verified,
                   lifetime_deposits, created_at, last_active
            FROM Users
            ORDER BY created_at
        """)
        
        sqlite_users = cursor.fetchall()
        print(f"Found {len(sqlite_users)} users in SQLite database")
        
        if not sqlite_users:
            print("No users found in SQLite. Migration complete.")
            return
            
    except Exception as e:
        print(f"Error reading SQLite: {e}")
        return
    
    # Step 2: Connect to Supabase
    print("\nStep 2: Connecting to Supabase...")
    try:
        # Convert to asyncpg format if needed
        if SUPABASE_URL.startswith("postgresql://"):
            db_url = f"postgresql+asyncpg://{SUPABASE_URL[len('postgresql://'):]}"
        else:
            db_url = f"postgresql+asyncpg://{SUPABASE_URL}"
        
        engine = create_async_engine(db_url, echo=False)
        session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        
        async with session_factory() as session:
            print("Connected to Supabase successfully!")
            
            # Import models
            from models import User, Transaction
            
            migrated_count = 0
            skipped_count = 0
            
            # Step 3: Migrate each user
            print(f"\nStep 3: Migrating users...")
            for sqlite_user in sqlite_users:
                try:
                    # Check if user already exists in Supabase (by telegram_id)
                    result = await session.execute(
                        select(User).where(User.telegram_id == sqlite_user['user_id'])
                    )
                    existing_user = result.scalar_one_or_none()
                    
                    if existing_user:
                        print(f"Skipping user {sqlite_user['username']} (ID: {sqlite_user['user_id']}) - already exists")
                        skipped_count += 1
                        continue
                    
                    # Create new user in Supabase
                    new_user = User(
                        id=uuid4(),
                        telegram_id=sqlite_user['user_id'],
                        phone=sqlite_user['phone_number'],
                        first_name=sqlite_user['username'] or 'Unknown',
                        last_name='',
                        username=sqlite_user['username'],
                        deposited_balance=float(sqlite_user['deposited_balance'] or 0),
                        won_balance=float(sqlite_user['won_balance'] or 0),
                        is_verified=bool(sqlite_user['is_verified']),
                        welcome_bonus_claimed=bool(sqlite_user['bonus_claimed']),
                        referral_count=sqlite_user['referral_count'] or 0,
                        created_at=datetime.fromisoformat(sqlite_user['created_at']) if sqlite_user['created_at'] else datetime.utcnow(),
                        last_active=datetime.fromisoformat(sqlite_user['last_active']) if sqlite_user['last_active'] else datetime.utcnow()
                    )
                    
                    session.add(new_user)
                    await session.flush()
                    
                    # Migrate transactions for this user
                    cursor.execute("""
                        SELECT user_id, type, amount, description, status, created_at
                        FROM Transactions 
                        WHERE user_id = ?
                        ORDER BY created_at
                    """, (sqlite_user['user_id'],))
                    
                    sqlite_transactions = cursor.fetchall()
                    
                    for tx in sqlite_transactions:
                        transaction = Transaction(
                            id=uuid4(),
                            user_id=new_user.id,
                            type=tx['type'],
                            amount=float(tx['amount']),
                            description=tx['description'],
                            status=tx['status'],
                            created_at=datetime.fromisoformat(tx['created_at']) if tx['created_at'] else datetime.utcnow()
                        )
                        session.add(transaction)
                    
                    migrated_count += 1
                    print(f"Migrated user: {sqlite_user['username']} (ID: {sqlite_user['user_id']})")
                    
                except Exception as e:
                    print(f"Error migrating user {sqlite_user['user_id']}: {e}")
                    continue
            
            # Commit all changes
            await session.commit()
            
            print(f"\nMigration Summary:")
            print(f"Total SQLite users: {len(sqlite_users)}")
            print(f"Successfully migrated: {migrated_count}")
            print(f"Skipped (already exists): {skipped_count}")
            print(f"Failed: {len(sqlite_users) - migrated_count - skipped_count}")
            
    except Exception as e:
        print(f"Error connecting to Supabase: {e}")
        return
    
    finally:
        sqlite_conn.close()
        await engine.dispose()

async def verify_migration():
    """Verify migration by comparing counts"""
    print("\n" + "=" * 50)
    print("VERIFICATION: Comparing SQLite vs Supabase")
    print("=" * 50)
    
    # SQLite count
    try:
        sqlite_conn = sqlite3.connect(SQLITE_DB)
        cursor = sqlite_conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM Users")
        sqlite_count = cursor.fetchone()[0]
        sqlite_conn.close()
        print(f"SQLite users: {sqlite_count}")
    except Exception as e:
        print(f"Error reading SQLite count: {e}")
        sqlite_count = 0
    
    # Supabase count
    try:
        if SUPABASE_URL.startswith("postgresql://"):
            db_url = f"postgresql+asyncpg://{SUPABASE_URL[len('postgresql://'):]}"
        else:
            db_url = f"postgresql+asyncpg://{SUPABASE_URL}"
        
        engine = create_async_engine(db_url, echo=False)
        session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        
        async with session_factory() as session:
            from models import User
            result = await session.execute(select(func.count(User.id)))
            supabase_count = result.scalar() or 0
            print(f"Supabase users: {supabase_count}")
            
            if sqlite_count == supabase_count:
                print("SUCCESS: All users migrated!")
            else:
                print(f"WARNING: Count mismatch - SQLite: {sqlite_count}, Supabase: {supabase_count}")
                
    except Exception as e:
        print(f"Error reading Supabase count: {e}")
    
    finally:
        await engine.dispose()

async def backup_sqlite_data():
    """Create backup of SQLite data before migration"""
    print("\nCreating SQLite backup...")
    try:
        import shutil
        backup_name = f"habesha_bingo_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db"
        shutil.copy2(SQLITE_DB, backup_name)
        print(f"Backup created: {backup_name}")
        return True
    except Exception as e:
        print(f"Backup failed: {e}")
        return False

async def main():
    """Main migration function"""
    print("SQLite to Supabase Migration Tool")
    print("=" * 50)
    
    # Check prerequisites
    if not os.path.exists(SQLITE_DB):
        print(f"Error: SQLite database '{SQLITE_DB}' not found")
        return
    
    if not SUPABASE_URL:
        print("Error: DATABASE_URL environment variable not set")
        return
    
    # Create backup
    if not await backup_sqlite_data():
        print("Warning: Backup failed. Continue at your own risk.")
        response = input("Continue anyway? (y/N): ")
        if response.lower() != 'y':
            return
    
    # Run migration
    await migrate_users_to_supabase()
    
    # Verify migration
    await verify_migration()
    
    print("\n" + "=" * 50)
    print("MIGRATION COMPLETE!")
    print("=" * 50)
    print("Next steps:")
    print("1. Test your bot with migrated users")
    print("2. Update complete_bot.py to use Supabase")
    print("3. Remove SQLite dependencies")
    print("4. Keep the SQLite file as backup")

if __name__ == "__main__":
    asyncio.run(main())
