import requests
import hashlib
import json

# ---------- PAYNOW TEST MODE CONFIG ----------
paynow_integration_id = '22041'  # From Paynow integration keys
paynow_integration_key = '2016f23f-6280-4195-8664-ad05950fb04b'  # From Paynow integration keys
paynow_url = 'https://www.paynow.co.zw/interface/initiatetransaction/'

merchant_email = 'josias@tishanyq.co.zw'  # Your Paynow merchant email (authemail)
test_mobile_number = '0771111111'  # SUCCESS: 0771111111, Delayed: 0772222222, Cancelled: 0773333333, Insufficient: 0774444444
# --------------------------------------------

# Transaction details
transaction = {
    'reference': 'TEST12345',  # Unique transaction reference
    'amount': '10.00',         # Amount in ZWL
    'additionalinfo': 'Test Payment',
    'authemail': merchant_email,
    'phone': test_mobile_number,
    'status': 'Message'
}

# Convert transaction dict to JSON string
transaction_json = json.dumps(transaction)

# Generate hash using integration key + JSON payload
hash_input = paynow_integration_key + transaction_json
hash_signature = hashlib.md5(hash_input.encode('utf-8')).hexdigest()

# Add hash to the request
payload = {
    'merchant': paynow_integration_id,
    'authemail': merchant_email,
    'reference': transaction['reference'],
    'amount': transaction['amount'],
    'additionalinfo': transaction['additionalinfo'],
    'phone': transaction['phone'],
    'status': transaction['status'],
    'hash': hash_signature
}

# Make the POST request to Paynow
response = requests.post(paynow_url, data=payload)

# Print Paynow response
print("Status Code:", response.status_code)
print("Response Text:", response.text)
