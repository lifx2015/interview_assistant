"""
声纹识别 API 路由 - 支持多种声纹识别渠道
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional

from backend.services.voiceprint_service import voiceprint_service

router = APIRouter(prefix="/voiceprint", tags=["voiceprint"])


class ProviderSwitchRequest(BaseModel):
    provider: str  # "simple" or "speechbrain"


@router.get("/providers")
async def get_providers():
    """获取所有可用的声纹识别渠道"""
    return voiceprint_service.get_provider_info()


@router.post("/provider")
async def switch_provider(req: ProviderSwitchRequest):
    """切换声纹识别渠道"""
    result = voiceprint_service.set_provider(req.provider)
    if result.get("success"):
        return result
    else:
        raise HTTPException(status_code=400, detail=result.get("error", "切换失败"))


class VoiceprintRegisterRequest(BaseModel):
    voice_id: str
    role: str  # "interviewer" or "candidate"
    name: str
    session_id: str


class VoiceprintResponse(BaseModel):
    success: bool
    voice_id: Optional[str] = None
    message: str = ""


@router.post("/enroll")
async def enroll_voiceprint(
    voice_id: str = Form(...),
    name: str = Form(...),
    role: str = Form("interviewer"),
    session_id: str = Form(None),
    audio_file: UploadFile = File(...)
):
    """
    注册声纹（默认录入面试官到全局会话）

    - voice_id: 唯一标识符
    - name: 显示名称
    - role: 角色（默认 interviewer）
    - session_id: 会话ID（默认全局会话）
    - audio_file: 音频文件 (PCM/WAV格式)
    """
    try:
        audio_data = await audio_file.read()

        result = voiceprint_service.enroll_voiceprint(
            voice_id=voice_id,
            name=name,
            audio_data=audio_data,
            role=role,
            session_id=session_id
        )

        if result.get("success"):
            return {
                "success": True,
                "voice_id": result["voice_id"],
                "sample_duration": result.get("sample_duration", 0),
                "message": f"声纹注册成功: {name}"
            }
        else:
            raise HTTPException(status_code=500, detail=result.get("error", "注册失败"))

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/list")
async def list_voiceprints():
    """获取所有全局面试官声纹"""
    voiceprints = voiceprint_service.get_global_voiceprints()
    return {
        "success": True,
        "voiceprints": voiceprints,
        "count": len(voiceprints)
    }


@router.delete("/delete/{voice_id}")
async def delete_voiceprint(voice_id: str):
    """删除指定声纹"""
    success = voiceprint_service.delete_voiceprint(voice_id)
    return {
        "success": success,
        "message": "已删除" if success else "声纹不存在"
    }


@router.delete("/clear")
async def clear_all_voiceprints():
    """清除所有全局面试官声纹"""
    count = voiceprint_service.clear_session_voiceprints()
    return {
        "success": True,
        "message": f"已清除 {count} 个声纹"
    }
