import boto3
import os
from dotenv import load_dotenv

def test_ses_mumbai():
    # Load environment variables
    load_dotenv()
    
    aws_access_key = os.getenv('AWS_ACCESS_KEY_ID')
    aws_secret_key = os.getenv('AWS_SECRET_ACCESS_KEY')
    region = 'ap-south-1'  # Mumbai
    sender = 'noreply@techsalesaxis.com'
    recipient = 'mithunkaveriappa.mk@gmail.com'
    
    print(f"--- SES TEST (MUMBAI) ---")
    print(f"Sender: {sender}")
    print(f"Recipient: {recipient}")
    
    # Create SES client
    ses = boto3.client(
        'ses',
        region_name=region,
        aws_access_key_id=aws_access_key,
        aws_secret_access_key=aws_secret_key
    )
    
    try:
        # Try sending a simple transactional email
        response = ses.send_email(
            Source=sender,
            Destination={'ToAddresses': [recipient]},
            Message={
                'Subject': {'Data': 'TalentFlow Test OTP'},
                'Body': {
                    'Text': {'Data': 'Hello,\n\nYour TalentFlow verification code is: 123456\n\nThis is a test email sent from the Mumbai region (ap-south-1).'},
                    'Html': {
                        'Data': '<h3>TalentFlow Verification</h3><p>Your verification code is: <strong>123456</strong></p><p>This is a test email sent from the Mumbai region (ap-south-1).</p>'
                    }
                }
            }
        )
        print(f"SUCCESS! Message ID: {response['MessageId']}")
        print("Please check your inbox (and spam folder) for the email.")
        
    except Exception as e:
        print(f"FAILURE: {str(e)}")
        if "MessageRejected" in str(e) and "Email address is not verified" in str(e):
            print("\nNOTE: AWS Sandbox still thinks one of the addresses is not verified.")
            print("Make sure both techsalesaxis.com and mithunkaveriappa.mk@gmail.com are 'Verified' in Mumbai.")

if __name__ == "__main__":
    test_ses_mumbai()
