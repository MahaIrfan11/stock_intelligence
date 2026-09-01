from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas.opportunity import OpportunityResponse
from app.services import opportunity_service

router = APIRouter(prefix="/opportunities", tags=["opportunities"])


@router.get("", response_model=OpportunityResponse)
def get_opportunities(
    db: Annotated[Session, Depends(get_db)],
    product_type: str | None = None,
    location: str | None = None,
    limit: int = Query(50, ge=1, le=200),
):
    return opportunity_service.find_opportunities(db, product_type, location, limit)
