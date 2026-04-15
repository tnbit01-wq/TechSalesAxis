import requests, os, json
from dotenv import load_dotenv

load_dotenv('.env')
token = os.getenv('SMTP_PASSWORD')
from_email = os.getenv('SMTP_FROM_EMAIL')
target = 'mithunkaveriappa.mk@gmail.com'
template_id = os.getenv('ZEPTO_OTP_TEMPLATE_ID')

# Check lowercase headers which some proxies require
headers = {
  'authorization': token,
  'content-type': 'application/json',
  'accept': 'application/json'
}

payload = {
  'mail_template_key': template_id,
  'from': {'address': from_email, 'name': 'TechSalesAxis'},
  'to': [{'email_address': {'address': target, 'name': 'Mithun'}}],
  'merge_info': {'OTP': '123456', 'username': 'Mithun', 'reset_password_link': 'http://localhost/reset'}
}

# Try the GLOBAL endpoint (some India accounts are mirrored on .com)
print('--- Testing GLOBAL .com Endpoint ---')
try:
    response = requests.post('https://api.zeptomail.com/v1.1/email/template', 
                         headers=headers, 
                         json=payload,
                         timeout=10)
    print(f'Status: {response.status_code}')
    print(f'Response: {response.text}')
except Exception as e:
  print(f'Error: {e}')

# Try the Indian endpoint again but with different header
print('\\n--- Testing Indian .in Endpoint with authorization-key Header ---')
headers = {
  'authorization-key': token,
  'content-type': 'application/json'
}
try:
    response = requests.post('https://api.zeptomail.in/v1.1/email/template', 
                         headers=headers, 
                         json=payload,
                         timeout=10)
    print(f'Status: {response.status_code}')
    print(f'Response: {response.text}')
except Exception as e:
  print(f'Error: {e}')
