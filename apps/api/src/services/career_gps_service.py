from typing import Dict, Any, List
from sqlalchemy.orm import Session
from src.core.database import SessionLocal
from src.core.models import CandidateProfile, CareerGPS, CareerMilestone
from src.core.config import OPENAI_API_KEY
import json
import httpx
import asyncio
from datetime import datetime

class CareerGPSService:
    @staticmethod
    def get_prompt(profile: Dict[str, Any], candidate_info: Dict[str, Any]) -> str:
        skills = ", ".join(profile.get("skills", [])) if profile.get("skills") else "None"
        experience = profile.get("experience", "fresher")
        target_role = candidate_info.get("target_role", "SaaS Sales Leader")
        interests = candidate_info.get("career_interests", "Enterprise Tech Sales")
        if isinstance(interests, list):
            interests = ", ".join(interests)
        learning = candidate_info.get("learning_interests", "")
        if isinstance(learning, list):
            learning = ", ".join(learning)
            
        return f"""
        You are an elite Career Architect specialized ONLY in Tech Sales.
        Generate a roadmap for:
        - target_role: {target_role}
        - experience: {experience}
        - current_skills: {skills}
        - actively_learning: {learning}
        - career_vertical_interest: {interests}
        
        CRITICAL: 
        1. Return ONLY a valid JSON object.
        2. Ensure "learning_actions" contains actual links to high-quality resources (Coursera, LinkedIn Learning, Salesforce Trailhead, HubSpot Academy).
        3. Do not include any markdown formatting like ```json.
        
        Return a valid JSON object:
        {{
          "target_role": "{target_role}",
          "milestones": [
            {{
              "step_order": 1,
              "title": "Role Name",
              "description": "Succinct description.",
              "skills_to_acquire": ["skill1", "skill2"],
              "learning_actions": [{{ "title": "course", "platform": "trailhead", "url": "link" }}]
            }}
          ]
        }}
        """

    @staticmethod
    async def generate_gps(user_id: str, candidate_info: Dict[str, Any], db: Session):
        profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == user_id).first()
        if not profile:
            raise Exception("Profile not found")
            
        # Clear old GPS and milestones first
        old_gps = db.query(CareerGPS).filter(CareerGPS.candidate_id == user_id).all()
        for og in old_gps:
            db.query(CareerMilestone).filter(CareerMilestone.gps_id == og.id).delete()
        db.query(CareerGPS).filter(CareerGPS.candidate_id == user_id).delete()
        db.commit()

        profile.current_role = candidate_info.get("target_role", profile.current_role)
        prompt = CareerGPSService.get_prompt(profile.__dict__, candidate_info)
        
        data = None
        # Call OpenAI GPT-4o
        if OPENAI_API_KEY:
            try:
                async with httpx.AsyncClient(timeout=45.0) as client:
                    resp = await client.post(
                        "https://api.openai.com/v1/chat/completions",
                        headers={"Authorization": f"Bearer {OPENAI_API_KEY}"},
                        json={
                            "model": "gpt-4o",
                            "messages": [{"role": "user", "content": prompt}],
                            "response_format": { "type": "json_object" }
                        }
                    )
                    if resp.status_code == 200:
                        content = resp.json()["choices"][0]["message"]["content"]
                        data = json.loads(content)
            except Exception as e:
                print(f"DEBUG: GPS OpenAI Failed: {e}")
                raise Exception("AI generation failed to produce valid career data. Please try again.")

        if not data:
             raise Exception("AI generation failed to produce valid career data. Please try again.")

        new_gps = CareerGPS(
            candidate_id=user_id,
            target_role=data.get("target_role", candidate_info.get("target_role", "Career Roadmap")),
            current_status="active"
        )
        db.add(new_gps)
        db.flush()
        
        for m in data.get("milestones", []):
            milestone = CareerMilestone(
                gps_id=new_gps.id,
                step_order=m.get("step_order", 0),
                title=m.get("title", "Untitled Step"),
                description=m.get("description", ""),
                skills_to_acquire=m.get("skills_to_acquire", []),
                learning_actions=m.get("learning_actions", []),
                status="not-started"
            )
            db.add(milestone)
            
        db.commit()
        return {"status": "success", "gps_id": str(new_gps.id)}
