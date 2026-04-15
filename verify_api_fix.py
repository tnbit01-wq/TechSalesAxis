import requests, os, json
from dotenv import load_dotenv

load_dotenv('.env')
token = os.getenv('SMTP_PASSWORD')
from_email = os.getenv('SMTP_FROM_EMAIL')
target = 'mithunkaveriappa.mk@gmail.com'
template_id = os.getenv('ZEPTO_OTP_TEMPLATE_ID')

# Correct structure for ZeptoMail 'mail_template_key'
headers = {
    'Authorization': token,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
}

payload = {
    'mail_template_key': template_id,
    'from': {'address': from_email, 'name': 'TechSales Axis'},
    'to': [{'email_address': {'address': target, 'name': 'Mithun'}}],
    'merge_info': {
        'OTP': '998877',
        'username': 'Mithun'
    }
}

print('--- Testing CORRECTED Payload Structure ---')
response = requests.post('https://api.zeptomail.in/v1.1/email/template', 
                         headers=headers, 
                         json=payload,
                         timeout=15)
print(f'Status: {response.status_code}')
print(f'Response: {response.text}')
