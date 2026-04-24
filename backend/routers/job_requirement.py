"""
岗位要求管理 API 路由
"""
import time
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.services import database

router = APIRouter(prefix="/job-requirement", tags=["job-requirement"])


class JobRequirement(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class CreateJobRequirementRequest(BaseModel):
    name: str
    description: Optional[str] = None


class UpdateJobRequirementRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


@router.get("/list")
async def list_job_requirements():
    requirements = await database.list_job_requirements()
    return {"requirements": requirements}


@router.post("/create")
async def create_job_requirement(req: CreateJobRequirementRequest):
    jr_id = f"jr_{int(time.time() * 1000)}"
    jr = await database.create_job_requirement(jr_id, req.name, req.description or "")
    return {"success": True, "requirement": jr}


@router.get("/{jr_id}")
async def get_job_requirement(jr_id: str):
    jr = await database.get_job_requirement(jr_id)
    if not jr:
        raise HTTPException(status_code=404, detail="岗位要求不存在")
    return jr


@router.put("/{jr_id}")
async def update_job_requirement(jr_id: str, req: UpdateJobRequirementRequest):
    jr = await database.update_job_requirement(jr_id, name=req.name, description=req.description)
    if not jr:
        raise HTTPException(status_code=404, detail="岗位要求不存在")
    return {"success": True, "requirement": jr}


@router.delete("/{jr_id}")
async def delete_job_requirement(jr_id: str):
    success = await database.delete_job_requirement(jr_id)
    if not success:
        raise HTTPException(status_code=404, detail="岗位要求不存在")
    return {"success": True, "message": "岗位要求已删除"}
