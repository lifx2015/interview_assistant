"""
声纹识别 API 路由
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional

from backend.services.voiceprint_service import voiceprint_service

router = APIRouter(prefix="/voiceprint", tags=["voiceprint"])


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
    role: str = Form(...),
    name: str = Form(...),
    session_id: str = Form(...),
    audio_file: UploadFile = File(...)
):
    """
    注册声纹

    - voice_id: 唯一标识符
    - role: interviewer 或 candidate
    - name: 显示名称
    - session_id: 会话ID
    - audio_file: 音频文件 (PCM/WAV格式)
    """
    try:
        audio_data = await audio_file.read()

        result = voiceprint_service.enroll_voiceprint(
            voice_id=voice_id,
            role=role,
            name=name,
            audio_data=audio_data,
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


@router.get("/list/{session_id}")
async def list_voiceprints(session_id: str):
    """获取会话的所有声纹"""
    voiceprints = voiceprint_service.get_session_voiceprints(session_id)
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


@router.delete("/clear/{session_id}")
async def clear_session_voiceprints(session_id: str):
    """清除会话的所有声纹"""
    count = voiceprint_service.clear_session_voiceprints(session_id)
    return {
        "success": True,
        "message": f"已清除 {count} 个声纹"
    }
