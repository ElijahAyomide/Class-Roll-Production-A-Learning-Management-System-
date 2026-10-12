import React, { useState } from 'react';
import { CreditCard, ShieldCheck, Lock } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import Badge from '../components/Badge';
import Modal from '../components/Modal';
import { useSchool } from '../context/SchoolContext';
import { verifyAndCreditPurchase, fetchLicense } from '../lib/license';
import { signInAdmin } from '../lib/auth';

export default function License({ license, setLicense }) {
  const { school } = useSchool();
  const [examCount, setExamCount] = useState(50);
  const [processing, setProcessing] = useState(false);
  const [confirmingPassword, setConfirmingPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [verifyingPassword, setVerifyingPassword] = useState(false);
  const [purchaseError, setPurchaseError] = useState('');

  const total = examCount * license.pricePerExam;

  const requestPurchase = (e) => {
    e.preventDefault();
    if (!examCount || examCount <= 0) return;
    setPassword('');
    setPasswordError('');
    setPurchaseError('');
    setConfirmingPassword(true);
  };

  const openPaystackCheckout = () => {
    if (!window.PaystackPop) {
      setPurchaseError('Payment system failed to load. Please refresh the page and try again.');
      return;
    }
    setProcessing(true);
    const reference = `CR-${school.code}-${Date.now()}`;

    const handler = window.PaystackPop.setup({
      key: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY,
      email: school.email,
      amount: Math.round(total * 100), // Paystack expects kobo, not naira
      currency: 'NGN',
      ref: reference,
      metadata: { schoolId: school.id, examCount },
      callback: function (response) {
        // IMPORTANT: this callback firing does NOT mean the payment is
        // trustworthy on its own — it just means Paystack's popup closed
        // with a reference. The real check happens server-side next.
        verifyAndCreditPurchase(response.reference, school.id, examCount)
          // The server may report the payment was already credited (by the
          // Paystack webhook), so we simply reload the real balance and
          // history rather than trying to patch them by hand.
          .then(() => fetchLicense(school.id))
          .then((fresh) => {
            setLicense(fresh);
            setProcessing(false);
          })
          .catch((err) => {
            setPurchaseError(err.message || 'Payment could not be verified. If you were charged, contact support with reference ' + response.reference + '.');
            setProcessing(false);
          });
      },
      onClose: function () {
        setProcessing(false);
      },
    });
    handler.openIframe();
  };

  const confirmAndPay = async (e) => {
    e.preventDefault();
    if (!password.trim()) {
      setPasswordError('Enter your password to continue.');
      return;
    }
    setVerifyingPassword(true);
    setPasswordError('');
    try {
      // Re-checks the real password against your actual account —
      // signing in again with the same credentials doesn't disrupt your
      // current session, it just confirms you are who you say you are
      // right before real money moves.
      await signInAdmin(school.email, password);
      setConfirmingPassword(false);
      openPaystackCheckout();
    } catch (err) {
      setPasswordError('Incorrect password.');
    } finally {
      setVerifyingPassword(false);
    }
  };

  return (
    <DashboardLayout title="License" subtitle="Each subject you set a test or exam for uses 1 credit — buy more here when you run low">
      <div className="license-grid">
        <div className="card license-balance-card">
          <div className="license-balance-icon"><ShieldCheck size={22} /></div>
          <div className="license-balance-value">{license.balance}</div>
          <div className="license-balance-label">exam credits remaining</div>
          <div className="license-balance-note">Each credit lets one student take one exam. Credits are used automatically as students submit exams.</div>
        </div>

        <div className="card">
          <div className="card-label">Buy exam credits</div>
          <form onSubmit={requestPurchase} className="quick-add-form">
            <div className="field">
              <label>NUMBER OF EXAMS</label>
              <input
                type="number" min="1" value={examCount}
                onChange={e => setExamCount(parseInt(e.target.value) || 0)}
              />
            </div>
            <div className="purchase-summary">
              <div className="purchase-row"><span>Price per exam</span><span>₦{license.pricePerExam}</span></div>
              <div className="purchase-row purchase-total"><span>Total</span><span>₦{total.toLocaleString('en-NG')}</span></div>
            </div>
            <button type="submit" className="btn-primary" disabled={processing}>
              <CreditCard size={15} /> {processing ? 'Processing…' : 'Proceed to Payment'}
            </button>
            {purchaseError && <div className="error-text">{purchaseError}</div>}
            <div className="field-hint">You'll be asked to confirm your password, then pay securely via Paystack.</div>
          </form>
        </div>
      </div>

      <div className="card">
        <div className="card-label">Payment history</div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Exams Purchased</th>
                <th>Amount</th>
                <th>Reference</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {license.history.length === 0 ? (
                <tr><td colSpan={5} className="empty-note-cell">No payments yet.</td></tr>
              ) : license.history.map(p => (
                <tr key={p.id}>
                  <td className="cell-dim">{p.date}</td>
                  <td>{p.exams}</td>
                  <td className="cell-strong">₦{p.amount.toLocaleString('en-NG')}</td>
                  <td className="cell-mono">{p.reference}</td>
                  <td><Badge tone="green">{p.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {confirmingPassword && (
        <Modal title="Confirm Your Password" onClose={() => setConfirmingPassword(false)} width={380}>
          <form onSubmit={confirmAndPay} className="quick-add-form">
            <div className="password-confirm-summary">
              <Lock size={14} />
              <span>Confirm your password to purchase <b>{examCount}</b> exam credit{examCount === 1 ? '' : 's'} for <b>₦{total.toLocaleString('en-NG')}</b>.</span>
            </div>
            <div className="field">
              <label>PASSWORD</label>
              <input
                type="password" placeholder="••••••••" autoFocus
                value={password} onChange={e => { setPassword(e.target.value); setPasswordError(''); }}
              />
              {passwordError && <div className="error-text">{passwordError}</div>}
            </div>
            <div className="confirm-actions">
              <button type="button" className="btn-ghost" onClick={() => setConfirmingPassword(false)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={verifyingPassword}>
                {verifyingPassword ? 'Checking…' : 'Confirm & Pay'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </DashboardLayout>
  );
}
