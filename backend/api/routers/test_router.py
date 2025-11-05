"""
Ultra-simple test endpoint to debug async issues
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from api.dependencies import get_current_user
from django.contrib.auth import get_user_model

User = get_user_model()

router = APIRouter()


class TestResponse(BaseModel):
    message: str
    user_id: str
    user_email: str


@router.get("/test", response_model=TestResponse)
async def test_endpoint(
    current_user: User = Depends(get_current_user)
):
    """Ultra-simple test endpoint"""
    return {
        "message": "Success!",
        "user_id": str(current_user.id),
        "user_email": current_user.email
    }
