import requests, os, json
from dotenv import load_dotenv

load_dotenv('.env')
token = os.getenv('SMTP_PASSWORD')
from_email = os.getenv('SMTP_FROM_EMAIL')
target = 'mithunkaveriappa.mk@gmail.com'
template_id = os.getenv('ZEPTO_OTP_TEMPLATE_ID')

# Zoho API can sometimes be picky about headers or the exact structure of the JSON payload.
# If 'Zoho-encz' fails with 500, we'll try the 'Raw Token' again with the CORRECT payload structure.

headers = {
    'Authorization': token,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
}

payload = {
    'mail_template_key': template_id,
    'from': {'address': from_email, 'name': 'TechSalesAxis'},
    'to': [{'email_address': {'address': target, 'name': 'Mithun'}}],
    'merge_info': {
        'OTP': '123456',
        'username': 'Mithun',
        'reset_password_link': 'http://localhost/reset'
    }
}

print('--- Testing Raw Token with FULL Payload ---')
response = requests.post('https://api.zeptomail.in/v1.1/email/template', 
                         headers=headers, 
                         data=json.dumps(payload),
                         timeout=15)
print(f'Status: {response.status_code}')
print(f'Response: {response.text}')
