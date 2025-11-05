"""
FastAPI Main Application
"""
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from contextlib import asynccontextmanager
import os
import django
from decouple import config
import logging

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

# Import routers (after Django setup)
from api.routers import auth, transactions, kyc, notifications, admin, blockchain, test_router, bundler
from api.routers import wallets_simple as wallets  # Use simple Django-based wallet router
from api.routers import payments

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager for FastAPI"""
    logger.info("🚀 FastAPI application starting up...")
    yield
    logger.info("🛑 FastAPI application shutting down...")

# Create FastAPI application
app = FastAPI(
    title="CPPay API",
    description="Crypto Payment Platform - High-performance API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=config('CORS_ALLOWED_ORIGINS', default='*', cast=lambda v: v.split(',')),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Exception Handlers
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle validation errors"""
    # Convert validation errors to JSON-serializable format
    errors = []
    for error in exc.errors():
        error_dict = {
            "type": error.get("type"),
            "loc": error.get("loc"),
            "msg": error.get("msg"),
            "input": str(error.get("input")) if error.get("input") is not None else None,
        }
        # Convert ctx values to strings if they exist
        if "ctx" in error:
            error_dict["ctx"] = {k: str(v) for k, v in error["ctx"].items()}
        errors.append(error_dict)
    
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "success": False,
            "message": "Validation error",
            "errors": errors,
        },
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle general exceptions"""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "message": "Internal server error",
            "detail": str(exc) if config('DJANGO_DEBUG', default=False, cast=bool) else None,
        },
    )

# Health check endpoints
@app.get("/", tags=["Health"])
async def root():
    """Root endpoint"""
    return {
        "success": True,
        "message": "CPPay API is running",
        "version": "1.0.0",
    }

@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint"""
    from asgiref.sync import sync_to_async
    from django.db import connection
    from django.core.cache import cache
    
    # Check database (using sync_to_async for Django ORM)
    db_status = "healthy"
    try:
        await sync_to_async(connection.ensure_connection)()
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"
    
    # Check cache (using sync_to_async for Django cache)
    cache_status = "healthy"
    try:
        await sync_to_async(cache.set)('health_check', 'ok', 10)
        cached_value = await sync_to_async(cache.get)('health_check')
        if cached_value != 'ok':
            cache_status = "unhealthy: cache not working"
    except Exception as e:
        cache_status = f"unhealthy: {str(e)}"
    
    is_healthy = db_status == "healthy" and cache_status == "healthy"
    
    return {
        "success": is_healthy,
        "status": "healthy" if is_healthy else "unhealthy",
        "checks": {
            "database": db_status,
            "cache": cache_status,
        },
    }

# Include routers
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(blockchain.router, prefix="/api/v1", tags=["Blockchain"])
app.include_router(wallets.router, prefix="/api/v1/wallets", tags=["Wallets"])
app.include_router(test_router.router, prefix="/api/v1", tags=["Testing"])  # Debug router
app.include_router(transactions.router, prefix="/api/v1/transactions", tags=["Transactions"])
app.include_router(payments.router, prefix="/api/v1/payments", tags=["Payments"])
app.include_router(kyc.router, prefix="/api/v1/kyc", tags=["KYC"])
app.include_router(notifications.router, prefix="/api/v1/notifications", tags=["Notifications"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["Admin"])
app.include_router(bundler.router, prefix="/api/v1", tags=["Bundler"])

# Startup event
@app.on_event("startup")
async def startup_event():
    """Startup tasks"""
    logger.info("✅ FastAPI application started successfully")

# Shutdown event
@app.on_event("shutdown")
async def shutdown_event():
    """Shutdown tasks"""
    logger.info("👋 FastAPI application shutdown complete")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "api.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
    )
