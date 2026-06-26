from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import google.generativeai as genai
import os
import json
import re

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST"],
    allow_headers=["*"],
)

genai.configure(api_key=os.environ["GEMINI_API_KEY"])

class ChecklistRequest(BaseModel):
    business_type: str
    state: str
    employee_count: str

@app.post("/api/generate")
async def generate_checklist(req: ChecklistRequest):
    prompt = f"""You are a senior Indian data privacy lawyer specialising in the Digital Personal Data Protection Act, 2023 (DPDP Act) and its Draft Rules 2025.

Generate a compliance checklist for:
- Business type: {req.business_type}
- State: {req.state}
- Employee count: {req.employee_count}

Return ONLY a valid JSON array with no markdown, no code fences, no explanation. Each item must have exactly these fields:
- "section": one of ["Data Principal Rights", "Consent Management", "Data Fiduciary Obligations", "Data Localisation & Cross-Border Transfers", "Security Safeguards", "Grievance Redressal", "State-Specific Requirements", "Significant Data Fiduciary Obligations"]
- "title": short action item (max 12 words)
- "desc": 1-2 sentence practical explanation referencing specific DPDP Act sections or rules where relevant
- "priority": exactly one of "critical", "high", or "medium"

Include 20-24 items total. Tailor items specifically to the business type and state. For {req.state}, include relevant state government IT policies, sector regulators, or data sharing obligations. Mark Significant Data Fiduciary obligations only if scale and business type warrants it. Return pure JSON array only — no other text."""

    try:
        model = genai.GenerativeModel("gemini-2.0-flash")
        response = model.generate_content(prompt)
        raw = response.text.strip()
        raw = re.sub(r"```json|```", "", raw).strip()
        items = json.loads(raw)
        return {"items": items}
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Failed to parse AI response. Please try again.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
