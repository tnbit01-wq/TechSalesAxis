import requests, os, json
from dotenv import load_dotenv

load_dotenv('.env')
token = os.getenv('SMTP_PASSWORD')
from_email = os.getenv('SMTP_FROM_EMAIL')
target = 'mithunkaveriappa.mk@gmail.com'
template_id = os.getenv('ZEPTO_OTP_TEMPLATE_ID')

# Check token length for debug
print(f'Token Length: {len(token)}')

# Combination 1: Authorization Header (Most likely)
headers_1 = {
    'Authorization': f'Zoho-encz {token}',
    'Content-Type': 'application/json',
    'Accept': 'application/json'
}

# Payload with MERGE INFO (Important: OTP and username must PRECISELY match the template)
payload = {
    'mail_template_key': template_id,
    'from': {'address': from_email, 'name': 'TechSalesAxis'},
    'to': [{'email_address': {'address': target, 'name': 'Mithun'}}],
    'merge_info': {
        'OTP': '123456',
        'username': 'Mithun',
        'reset_password_link': 'http://localhost:3000/auth/reset'
    }
}

print('\\nTesting Zoho-encz Prefix with Payload...')
try:
    response = requests.post('https://api.zeptomail.in/v1.1/email/template', 
                             headers=headers_1, 
                             data=json.dumps(payload), 
                             timeout=15)
    print(f'Status: {response.status_code}')
    print(f'Body: {response.text}')
except Exception as e:
    print(f'Error: {e}')
