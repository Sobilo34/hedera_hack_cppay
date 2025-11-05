"""
Notifications Router - Placeholder
Will be implemented in Phase 5
"""
from fastapi import APIRouter

router = APIRouter()

@router.get("/")
async def notifications_placeholder():
    return {"message": "Notification endpoints will be implemented in Phase 5"}
