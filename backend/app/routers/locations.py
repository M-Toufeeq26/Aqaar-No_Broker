from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models
from app.schemas import StateResponse, CityResponse

router = APIRouter(prefix="/locations", tags=["locations"])

@router.get("/states", response_model=list[StateResponse])
def get_states(db: Session = Depends(get_db)):
    states = db.query(models.State).order_by(models.State.name).all()
    return [StateResponse(id=state.id, name=state.name) for state in states]

@router.get("/cities/{state_id}", response_model=list[CityResponse])
def get_cities(state_id: int, db: Session = Depends(get_db)):
    state = db.query(models.State).filter(models.State.id == state_id).first()
    if not state:
        raise HTTPException(status_code=404, detail="State not found")
    
    cities = db.query(models.City).filter(models.City.state_id == state_id).order_by(models.City.name).all()
    return [CityResponse(id=city.id, name=city.name) for city in cities]