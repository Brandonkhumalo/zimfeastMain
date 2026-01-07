#!/usr/bin/env python3
"""
ZimFeast Demo Payment Script

This script creates a test payment using Paynow sandbox mode.
Use this to test payment integration before going live.

Test Mobile Numbers:
- 0771111111 - Success (5 seconds)
- 0772222222 - Delayed Success (30 seconds)
- 0773333333 - User Cancelled (30 seconds)
- 0774444444 - Insufficient Balance (immediate fail)

Usage:
    python demo_payment.py [--amount AMOUNT] [--phone PHONE] [--method METHOD]

Examples:
    python demo_payment.py                          # Web checkout, $5.00
    python demo_payment.py --amount 10.00           # Web checkout, $10.00
    python demo_payment.py --method ecocash         # EcoCash, $5.00, success number
    python demo_payment.py --method ecocash --phone 0772222222  # EcoCash delayed success
"""

import argparse
import time
from paynow import Paynow

INTEGRATION_ID = "22041"
INTEGRATION_KEY = "2016f23f-6280-4195-8664-ad05950fb04b"
RETURN_URL = "https://2d8d3232-66c2-43c2-9587-32dfd8fe00de-00-xr3sjktqw8gq.worf.replit.dev/payment-return"
RESULT_URL = "https://2d8d3232-66c2-43c2-9587-32dfd8fe00de-00-xr3sjktqw8gq.worf.replit.dev/api/payments/callback/"
MERCHANT_EMAIL = "josias@tishanyq.co.zw"

TEST_PHONES = {
    "success": "0771111111",
    "delayed": "0772222222",
    "cancelled": "0773333333",
    "insufficient": "0774444444"
}

def create_demo_payment(amount=5.00, phone=None, method="web"):
    """Create a demo payment transaction"""
    
    print("=" * 60)
    print("ZimFeast Demo Payment")
    print("=" * 60)
    print(f"Integration ID: {INTEGRATION_ID}")
    print(f"Merchant Email: {MERCHANT_EMAIL}")
    print(f"Amount: ${amount:.2f}")
    print(f"Method: {method}")
    if phone:
        print(f"Phone: {phone}")
    print("=" * 60)
    
    paynow = Paynow(
        integration_id=INTEGRATION_ID,
        integration_key=INTEGRATION_KEY,
        return_url=RETURN_URL,
        result_url=RESULT_URL
    )
    
    reference = f"DEMO_{int(time.time())}"
    payment = paynow.create_payment(reference, MERCHANT_EMAIL)
    payment.add("Demo Order Item", float(amount))
    
    print(f"\nCreating payment with reference: {reference}")
    
    if method == "web":
        response = paynow.send(payment)
    elif method == "ecocash":
        phone = phone or TEST_PHONES["success"]
        print(f"Sending EcoCash payment to: {phone}")
        response = paynow.send_mobile(payment, phone, "ecocash")
    elif method == "onemoney":
        phone = phone or TEST_PHONES["success"]
        print(f"Sending OneMoney payment to: {phone}")
        response = paynow.send_mobile(payment, phone, "onemoney")
    else:
        print(f"Unknown method: {method}, using web checkout")
        response = paynow.send(payment)
    
    print("\n" + "=" * 60)
    print("PAYNOW RESPONSE")
    print("=" * 60)
    
    if response.success:
        print(f"Status: SUCCESS")
        print(f"Poll URL: {response.poll_url}")
        
        if hasattr(response, 'redirect_url') and response.redirect_url:
            print(f"\nRedirect URL (open in browser):")
            print(response.redirect_url)
            print("\n*** IMPORTANT: Login with merchant account to complete test payment ***")
            print(f"    Email: {MERCHANT_EMAIL}")
            print("    Select [TESTING: Faked Success] and click [Make Payment]")
        
        if method in ["ecocash", "onemoney"]:
            print(f"\nMobile payment initiated to {phone}")
            print("Waiting for response...")
            
            for i in range(6):
                time.sleep(5)
                status = paynow.check_transaction_status(response.poll_url)
                print(f"\n[{(i+1)*5}s] Status check:")
                print(f"  Paid: {status.paid}")
                print(f"  Status: {status.status}")
                
                if status.paid:
                    print("\n*** PAYMENT SUCCESSFUL! ***")
                    break
                elif status.status.lower() in ['failed', 'cancelled']:
                    print(f"\n*** PAYMENT {status.status.upper()} ***")
                    break
        
        return response
    else:
        print(f"Status: FAILED")
        print(f"Error: {response.error}")
        return None

def poll_status(poll_url):
    """Check payment status"""
    paynow = Paynow(
        integration_id=INTEGRATION_ID,
        integration_key=INTEGRATION_KEY,
        return_url=RETURN_URL,
        result_url=RESULT_URL
    )
    
    status = paynow.check_transaction_status(poll_url)
    print("\n" + "=" * 60)
    print("PAYMENT STATUS")
    print("=" * 60)
    print(f"Paid: {status.paid}")
    print(f"Status: {status.status}")
    if hasattr(status, 'amount'):
        print(f"Amount: {status.amount}")
    return status

def main():
    parser = argparse.ArgumentParser(description="ZimFeast Demo Payment Script")
    parser.add_argument("--amount", type=float, default=5.00, help="Payment amount in USD (default: 5.00)")
    parser.add_argument("--phone", type=str, help="Phone number for mobile payment")
    parser.add_argument("--method", choices=["web", "ecocash", "onemoney"], default="web", 
                        help="Payment method (default: web)")
    parser.add_argument("--poll", type=str, help="Poll URL to check status of existing payment")
    
    args = parser.parse_args()
    
    if args.poll:
        poll_status(args.poll)
    else:
        print("\n" + "=" * 60)
        print("TEST PHONE NUMBERS FOR MOBILE PAYMENTS")
        print("=" * 60)
        print("0771111111 - Success (5 seconds)")
        print("0772222222 - Delayed Success (30 seconds)")
        print("0773333333 - User Cancelled (30 seconds)")
        print("0774444444 - Insufficient Balance (immediate fail)")
        print("=" * 60 + "\n")
        
        create_demo_payment(
            amount=args.amount,
            phone=args.phone,
            method=args.method
        )

if __name__ == "__main__":
    main()
