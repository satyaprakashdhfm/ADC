'use client';

import { useEffect, useState } from 'react';

declare global {
  interface Window {
    Razorpay: any;
  }
}

const SATYA_KEY = process.env.NEXT_PUBLIC_SATYA_KEY || '';

export default function SatyaLiveTestPage() {
  const [status, setStatus] = useState('idle');
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);
    return () => { document.body.removeChild(script); };
  }, []);

  async function start() {
    setResult(null);
    setStatus('creating order…');
    const r = await fetch('/api/satya/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-satya-key': SATYA_KEY },
    });
    const data = await r.json();
    if (!r.ok) { setStatus('order failed'); setResult(data); return; }

    setStatus('opening checkout…');
    const rzp = new window.Razorpay({
      key: data.keyId,
      order_id: data.orderId,
      amount: data.amount,
      currency: 'INR',
      name: 'A Dough Cookie',
      description: 'Live payment harness — ₹1 test',
      handler: async (response: any) => {
        setStatus('verifying…');
        const vr = await fetch('/api/satya/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-satya-key': SATYA_KEY },
          body: JSON.stringify({
            orderId: response.razorpay_order_id,
            paymentId: response.razorpay_payment_id,
            signature: response.razorpay_signature,
          }),
        });
        const vdata = await vr.json();
        setResult(vdata);
        setStatus(vdata.ok ? `verified — ${vdata.status}` : 'verify failed');
      },
      modal: { ondismiss: () => setStatus('checkout closed') },
    });
    rzp.on('payment.failed', (resp: any) => {
      setResult(resp.error);
      setStatus(`payment failed: ${resp.error?.description || ''}`);
    });
    rzp.open();
  }

  return (
    <div style={{ padding: 40, fontFamily: 'monospace', maxWidth: 600, margin: '0 auto' }}>
      <h2>Live payment harness — ₹1</h2>
      <p>Standalone Razorpay live-mode test. Not tied to a real order.</p>
      <button onClick={start} style={{ padding: '12px 24px', fontSize: 16, cursor: 'pointer' }}>
        Pay ₹1 (LIVE)
      </button>
      <p>Status: {status}</p>
      {result && <pre style={{ background: '#111', color: '#0f0', padding: 12, overflowX: 'auto' }}>{JSON.stringify(result, null, 2)}</pre>}
    </div>
  );
}
