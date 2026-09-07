import React, { useState } from 'react';
import { CreditCard, ShieldCheck, Lock } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import Badge from '../components/Badge';
import Modal from '../components/Modal';
import { useSchool } from '../context/SchoolContext';
import { purchaseLicense } from '../lib/license';

export default function License({ license, setLicense }) {
  const { school } = useSchool();
  const [examCount, setExamCount] = useState(50);
  const [processing, setProcessing] = useState(false);
  const [confirmingPassword, setConfirmingPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [purchaseError, setPurchaseError] = useState('');

  const total = examCount * license.pricePerExam;

  const requestPurchase = (e) => {
    e.preventDefault();
    if (!examCount || examCount <= 0) return;
    setPassword('');
    setPasswordError('');
    setConfirmingPassword(true);
  };

  const confirmAndPay = async (e) => {
    e.preventDefault();
    if (!password.trim()) {
      setPasswordError('Enter your password to continue.');
      return;
    }
    // Demo mode — any password is accepted here. Real validation happens
    // against the school's actual account once Authentication is built.
    setConfirmingPassword(false);
    setProcessing(true);
    setPurchaseError('');
    try {
      const { balance, historyEntry } = await purchaseLicense(school.id, examCount, license.pricePerExam);
      setLicense(prev => ({ ...prev, balance, history: [historyEntry, ...prev.history] }));
    } catch (err) {
      setPurchaseError(err.message || 'Payment could not be completed. Please try again.');
    } finally {
      setProcessing(false);
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
            <div className="field-hint">You'll be asked to confirm your password before payment goes through.</div>
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
              <button type="submit" className="btn-primary">Confirm & Pay</button>
            </div>
            <div className="field-hint">Demo mode — any password is accepted for now. Real account validation is wired in during the Authentication build step.</div>
          </form>
        </Modal>
      )}
    </DashboardLayout>
  );
}
