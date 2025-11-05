"""
Database configuration and session management.
"""
from typing import AsyncGenerator
import os
from pathlib import Path
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base
from django.conf import settings

# Create async engine
# Convert Django DATABASE_URL to async format if needed
db_config = settings.DATABASES['default']
db_engine = db_config.get('ENGINE', '')

if 'sqlite' in db_engine:
    # SQLite database
    db_name = db_config.get('NAME', '')
    
    # Handle both absolute and relative paths
    if isinstance(db_name, Path):
        db_path = str(db_name)
    else:
        db_path = str(db_name) if db_name else 'db.sqlite3'
    
    # Make sure the path is absolute
    if not os.path.isabs(db_path):
        db_path = os.path.join(str(settings.BASE_DIR), db_path)
    
    ASYNC_DATABASE_URL = f"sqlite+aiosqlite:///{db_path}"
else:
    # PostgreSQL or other database
    # Construct URL from Django config
    user = db_config.get('USER', '')
    password = db_config.get('PASSWORD', '')
    host = db_config.get('HOST', 'localhost')
    port = db_config.get('PORT', '5432')
    name = db_config.get('NAME', '')
    
    if user and password:
        ASYNC_DATABASE_URL = f"postgresql+asyncpg://{user}:{password}@{host}:{port}/{name}"
    else:
        # Fallback to environment variable
        ASYNC_DATABASE_URL = os.getenv('DATABASE_URL', 'sqlite+aiosqlite:///db.sqlite3')

engine = create_async_engine(
    ASYNC_DATABASE_URL,
    echo=settings.DEBUG,
    future=True,
)

# Create async session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

# Base class for SQLAlchemy models (if needed alongside Django ORM)
Base = declarative_base()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency function to get database session.
    
    Usage in FastAPI:
        @router.get("/items")
        async def read_items(db: AsyncSession = Depends(get_db)):
            ...
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    """Initialize database tables (if using SQLAlchemy models)."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def close_db():
    """Close database connections."""
    await engine.dispose()
