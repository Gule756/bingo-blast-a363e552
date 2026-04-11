import asyncio
from database import Database

async def test_connection():
    print("Testing Supabase connection...")
    try:
        db = Database()
        await db.initialize()
        print("Database connected successfully! to Supabase")
        
        # Test a simple query
        from sqlalchemy import text
        result = await db.session.execute(text("SELECT version()"))
        version = result.scalar()
        print(f"PostgreSQL version: {version}")
        
        await db.engine.dispose()
        print("Connection closed successfully!")
        
    except Exception as e:
        print(f"Connection failed: {e}")
        return False
    
    return True

if __name__ == "__main__":
    success = asyncio.run(test_connection())
    if success:
        print("Supabase connection test PASSED")
    else:
        print("Supabase connection test FAILED")
