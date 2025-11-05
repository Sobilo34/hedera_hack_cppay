"""
Transactions Router - Simple Django ORM based
"""
from fastapi import APIRouter, Depends
from typing import List
from asgiref.sync import sync_to_async
from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from decimal import Decimal

from api.dependencies import get_current_user
from django.contrib.auth import get_user_model
from apps.transactions.models import Transaction

User = get_user_model()

router = APIRouter()


class TransactionOut(BaseModel):
    id: UUID
    transaction_type: str
    amount: str
    currency: str
    status: str
    created_at: datetime
    
    class Config:
        from_attributes = True


@router.get("/", response_model=List[TransactionOut])
async def list_transactions(
    current_user: User = Depends(get_current_user)
):
    """Get all transactions for current user"""
    
    # Get transactions (wrap Django ORM properly)
    def get_transactions():
        return list(Transaction.objects.filter(user=current_user).order_by('-created_at')[:50])
    
    transactions = await sync_to_async(get_transactions)()
    
    # Convert Decimal to string for JSON serialization
    for tx in transactions:
        tx.amount = str(tx.amount)
    
    return transactions

