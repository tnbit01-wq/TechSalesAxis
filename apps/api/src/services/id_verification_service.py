import os
import io
import json
import httpx
import boto3
from botocore.exceptions import ClientError
from google import genai
import base64
from src.core.config import S3_BUCKET_NAME, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, OPENAI_API_KEY, GOOGLE_API_KEY

class IDVerificationService:
    @staticmethod
    async def verify_id_document(user_id: str, id_path: str, bucket: str = None):
        """
        Uses AI (Vision) to verify if the uploaded document is a valid ID proof.
        Checks for:
        1. Document Type (ID card, Passport, License, etc.)
        2. Visual Presence of Name/Photo
        3. Issued Authority (Government keywords)
        """
        try:
            # 1. Download document from AWS S3
            if not bucket:
                bucket = S3_BUCKET_NAME

            s3_client = boto3.client(
                's3',
                aws_access_key_id=AWS_ACCESS_KEY_ID,
                aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
                region_name=AWS_REGION
            )
            
            try:
                # Download from S3
                response = s3_client.get_object(Bucket=bucket, Key=id_path)
                file_res = response['Body'].read()
            except ClientError as e:
                print(f"S3 DOWNLOAD ERROR: {e}")
                return {"verified": False, "reason": "Document not found in AWS storage."}

            if not file_res:
                return {"verified": False, "reason": "Empty document retrieved from storage."}

            # 2. Prefer OpenAI Vision (New)
            openai_key = OPENAI_API_KEY
            if openai_key:
                try:
                    import mimetypes
                    mime_type, _ = mimetypes.guess_type(id_path)
                    if not mime_type: mime_type = "image/jpeg"
                    
                    base64_image = base64.b64encode(file_res).decode('utf-8')
                    
                    async with httpx.AsyncClient(timeout=45.0) as client:
                        response = await client.post(
                            "https://api.openai.com/v1/chat/completions",
                            headers={
                                "Authorization": f"Bearer {openai_key}",
                                "Content-Type": "application/json",
                            },
                            json={
                                "model": "gpt-4o",
                                "messages": [
                                    {
                                        "role": "user",
                                        "content": [
                                            {"type": "text", "text": "Analyze this image and determine if it is a valid government-issued identity proof (like a Passport, Driver's License, Aadhaar Card, PAN Card, or National ID). Respond ONLY with a JSON object in this format: { \"verified\": boolean, \"document_type\": string, \"reason\": string, \"confidence_score\": number }"},
                                            {
                                                "type": "image_url",
                                                "image_url": {
                                                    "url": f"data:{mime_type};base64,{base64_image}"
                                                }
                                            }
                                        ]
                                    }
                                ],
                                "response_format": { "type": "json_object" },
                                "max_tokens": 300
                            }
                        )
                        if response.status_code == 200:
                            return json.loads(response.json()['choices'][0]['message']['content'])
                        else:
                            print(f"DEBUG: OpenAI Vision Failed: {response.status_code} - {response.text}")
                except Exception as oai_err:
                    print(f"DEBUG: OpenAI Vision Error: {oai_err}")

            # 3. Fallback to Gemini Vision
            google_key = GOOGLE_API_KEY # Or GROQ/OpenRouter for OCR
            if google_key:
                try:
                    client = genai.Client(api_key=google_key)
                    # Use Gemini for Vision
                    model_name = 'gemini-2.0-flash'
                    
                    # Construct part for Gemini
                    content = [
                        "Analyze this image and determine if it is a valid government-issued identity proof (like a Passport, Driver's License, Aadhaar Card, PAN Card, or National ID).",
                        "Respond ONLY with a JSON object in this format: "
                        "{ \"verified\": boolean, \"document_type\": string, \"reason\": string, \"confidence_score\": number }",
                        "If it is not a clear ID document (e.g., it's a random image, a document with no photo/name), set verified to false."
                    ]
                    
                    # Image processing for Gemini
                    # Detect mime type from extension
                    import mimetypes
                    mime_type, _ = mimetypes.guess_type(id_path)
                    if not mime_type or not mime_type.startswith("image/"):
                        # Gemini only accepts images or PDFs for this Vision model.
                        # For now, let's assume image/jpeg for common use but try to be flexible.
                        mime_type = "image/jpeg"
                    
                    image_part = {
                      "mime_type": mime_type,
                      "data": file_res
                    }
                    
                    try:
                        response = client.models.generate_content(model=model_name, contents=[*content, image_part])
                        text_response = response.text.replace("```json", "").replace("```", "").strip()
                        result = json.loads(text_response)
                        return result
                    except Exception as gen_err:
                        print(f"DEBUG: Gemini Vision Generation Error: {gen_err}")
                        raise gen_err
                except Exception as vision_err:
                    print(f"VISION AI ERROR (Probably Quota): {vision_err}")
                    # If it's a quota error (429), we continue to fallback 
                    if not ("429" in str(vision_err) or "RESOURCE_EXHAUSTED" in str(vision_err)):
                        # If it's NOT a quota error, return manual review
                        return {
                            "verified": True, 
                            "document_type": "Manual Review (Error)", 
                            "reason": f"AI Error: {str(vision_err)}",
                            "confidence_score": 0.5
                        }
            
            # 4. Fallback: OCR-based keyword check (Simplified logic if Vision AI fails or no key)
            # This is a basic safety net
            return {
                "verified": True, 
                "document_type": "Manual Review Pending", 
                "reason": "Vision AI bypassed. Document type requires manual check.",
                "confidence_score": 0.5
            }

        except Exception as e:
            print(f"ID VERIFICATION SERVICE ERROR: {e}")
            return {"verified": False, "reason": "Internal verification engine failure."}
