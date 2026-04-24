"""
声纹识别 API 路由 - 支持多种声纹识别渠道
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional

from backend.services.voiceprint_service import voiceprint_service

router = APIRouter(prefix="/voiceprint", tags=["voiceprint"])


class ProviderSwitchRequest(BaseModel):
    provider: str  # "mfcc"


@router.get("/providers")
async def get_providers():
    return voiceprint_service.get_provider_info()


@router.post("/provider")
async def switch_provider(req: ProviderSwitchRequest):
    result = voiceprint_service.set_provider(req.provider)
    if result.get("success"):
        return result
    else:
        raise HTTPException(status_code=400, detail=result.get("error", "切换失败"))


@router.post("/enroll")
async def enroll_voiceprint(
    voice_id: str = Form(...),
    name: str = Form(...),
    role: str = Form("interviewer"),
    session_id: str = Form(None),
    audio_file: UploadFile = File(...),
):
    try:
        audio_data = await audio_file.read()

        result = await voiceprint_service.enroll_voiceprint(
            voice_id=voice_id,
            name=name,
            audio_data=audio_data,
            role=role,
            session_id=session_id,
        )

        if result.get("success"):
            return {
                "success": True,
                "voice_id": result["voice_id"],
                "sample_duration": result.get("sample_duration", 0),
                "message": f"声纹注册成功: {name}",
            }
        else:
            raise HTTPException(status_code=500, detail=result.get("error", "注册失败"))

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/list")
async def list_voiceprints():
    voiceprints = await voiceprint_service.get_global_voiceprints()
    return {"success": True, "voiceprints": voiceprints, "count": len(voiceprints)}


@router.delete("/delete/{voice_id}")
async def delete_voiceprint(voice_id: str):
    success = await voiceprint_service.delete_voiceprint(voice_id)
    return {"success": success, "message": "已删除" if success else "声纹不存在"}


@router.delete("/clear")
async def clear_all_voiceprints():
    count = await voiceprint_service.clear_session_voiceprints()
    return {"success": True, "message": f"已清除 {count} 个声纹"}
