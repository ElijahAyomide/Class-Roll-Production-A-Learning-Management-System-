import React, { useState } from 'react';
import PasswordInput from '../components/PasswordInput';
import * as XLSX from 'xlsx';
import { CreditCard, Lock, Plus, Download, Check } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import AdminRail from '../components/AdminRail';
import Badge from '../components/Badge';
import Modal from '../components/Modal';
import { useSchool } from '../context/SchoolContext';
import { verifyAndCreditPurchase, fetchLicense } from '../lib/license';
import { signInAdmin } from '../lib/auth';

export default function License({ license, setLicense }) {
  const { school, session } = useSchool();
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
      await signInAdmin(session?.user?.email || school.email, password);
      setConfirmingPassword(false);
      openPaystackCheckout();
    } catch (err) {
      setPasswordError('Incorrect password.');
    } finally {
      setVerifyingPassword(false);
    }
  };

  // Starts a purchase of a fixed pack: sets the amount, then asks for the password.
  const buyPack = (n) => {
    setExamCount(n);
    setPassword('');
    setPasswordError('');
    setPurchaseError('');
    setConfirmingPassword(true);
  };

  const price = license.pricePerExam;
  const PACKS = [
    { name: 'Starter', credits: 100, blurb: 'For a single class or a short test.' },
    { name: 'School', credits: 500, blurb: 'A great fit for your next test week.', recommended: true },
    { name: 'Campus', credits: 1000, blurb: 'For bigger schools and busy terms.' },
  ];
  const naira = (n) => `₦${n.toLocaleString('en-NG')}`;

  // Used = everything ever bought minus what's left (never below zero).
  const purchased = license.history.reduce((n, p) => n + (p.exams || 0), 0);
  const used = Math.max(0, purchased - license.balance);
  const usedPct = purchased > 0 ? Math.min(100, (used / purchased) * 100) : 0;

  const exportHistory = () => {
    const rows = license.history.map(p => ({
      Date: p.date, 'Test credits': p.exams, Amount: p.amount, Reference: p.reference, Status: p.status,
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Billing history');
    XLSX.writeFile(wb, `billing-history-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const rail = (
    <AdminRail license={license}>
      <>
        <div className="rail-eyebrow">{school.name}</div>
        <div className="rail-title">Ready for the next test</div>
        <p className="rail-lead">One test credit covers one subject for one student.</p>
        <ul className="rail-checks">
          <li>
            <span className="rail-check"><Check size={13} /></span>
            <span>
              <span className="rail-step-title">Credits are used automatically</span>
              <span className="rail-step-desc">They're deducted when you set a test.</span>
            </span>
          </li>
          <li>
            <span className="rail-check"><Check size={13} /></span>
            <span>
              <span className="rail-step-title">Only pay for what you use</span>
              <span className="rail-step-desc">Questions and student records stay free.</span>
            </span>
          </li>
          <li>
            <span className="rail-check"><Check size={13} /></span>
            <span>
              <span className="rail-step-title">Secure payments</span>
              <span className="rail-step-desc">Pay safely with Paystack. Your password is confirmed first.</span>
            </span>
          </li>
        </ul>
      </>
    </AdminRail>
  );

  return (
    <DashboardLayout rail={rail} flush scroll>
      <div className="page-panel">
        <div className="panel-head">
          <div>
            <h2 className="panel-title">License</h2>
            <p className="panel-sub">Manage test credits and keep your tests running.</p>
          </div>
        </div>

        <div className="license-top">
          <div className="license-balance-blue">
            <div className="lb-label"><span>Available test credits</span><CreditCard size={18} /></div>
            <div className="lb-value">{license.balance} <small>credits remaining</small></div>
            <div className="lb-note">1 credit = 1 subject for 1 student, on a test.</div>
          </div>
          <div className="card license-usage">
            <div className="usage-head"><span className="usage-title">Credit usage</span><span className="usage-sub">{purchased.toLocaleString('en-NG')} credits purchased</span></div>
            <div className="usage-value">{used.toLocaleString('en-NG')} used</div>
            <div className="usage-bar"><span style={{ width: `${usedPct}%` }} /></div>
            <div className="usage-foot">{license.balance.toLocaleString('en-NG')} left to use</div>
          </div>
        </div>

        <div className="card buy-card">
          <div className="buy-head">
            <div>
              <div className="buy-title">Buy test credits</div>
              <div className="buy-sub">Choose a pack for your school. Credits are added instantly after payment.</div>
            </div>
            <span className="buy-secure"><Lock size={13} /> Secure checkout · NGN</span>
          </div>
          <div className="pack-grid">
            {PACKS.map(pk => (
              <div key={pk.name} className={`pack ${pk.recommended ? 'pack-recommended' : ''}`}>
                <div className="pack-top"><span className="pack-name">{pk.name}</span>{pk.recommended && <span className="pack-flag">Recommended</span>}</div>
                <div className="pack-credits">{pk.credits.toLocaleString('en-NG')} <small>test credits</small></div>
                <div className="pack-price">{naira(pk.credits * price)}</div>
                <div className="pack-per">{naira(price)} per credit</div>
                <div className="pack-blurb">{pk.blurb}</div>
                <button type="button" className={pk.recommended ? 'pack-btn pack-btn-solid' : 'pack-btn'} disabled={processing} onClick={() => buyPack(pk.credits)}>
                  <Plus size={15} /> {processing ? 'Processing…' : `Buy ${pk.credits.toLocaleString('en-NG')} credits`}
                </button>
              </div>
            ))}
          </div>
          {purchaseError && <div className="error-text">{purchaseError}</div>}
        </div>

        <div className="card custom-card">
          <div className="custom-card-text">
            <div className="custom-card-title">Need a different amount?</div>
            <div className="custom-card-sub">Enter exactly how many test credits you want. {naira(price)} per credit.</div>
          </div>
          <form onSubmit={requestPurchase} className="custom-form">
            <input type="number" min="1" value={examCount || ''} onChange={e => setExamCount(parseInt(e.target.value) || 0)} aria-label="Number of test credits" />
            <span className="custom-total">= {naira(total)}</span>
            <button type="submit" className="pack-btn pack-btn-solid" disabled={processing || !examCount}>
              <CreditCard size={15} /> {processing ? 'Processing…' : 'Proceed to payment'}
            </button>
          </form>
        </div>

        <div className="card roster-card billing-card">
          <div className="roster-head">
            <div className="roster-title">Billing history</div>
            <button className="btn-ghost" disabled={license.history.length === 0} onClick={exportHistory}><Download size={15} /> Download all</button>
          </div>
          <div className="table-wrap">
            <table className="data-table roster-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {license.history.length === 0 ? (
                  <tr><td colSpan={5} className="empty-note-cell">No payments yet.</td></tr>
                ) : license.history.map(p => (
                  <tr key={p.id}>
                    <td className="cell-strong cell-ref">{p.reference}</td>
                    <td className="cell-dim">{p.date}</td>
                    <td>{p.exams} test credits</td>
                    <td className="cell-strong">₦{p.amount.toLocaleString('en-NG')}</td>
                    <td><Badge tone="green">{p.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="page-footer">
        <span>{school.name}</span>
        <span>© {new Date().getFullYear()} Assessly</span>
      </div>

      {confirmingPassword && (
        <Modal title="Confirm Your Password" onClose={() => setConfirmingPassword(false)} width={380}>
          <form onSubmit={confirmAndPay} className="quick-add-form">
            <div className="password-confirm-summary">
              <Lock size={14} />
              <span>Confirm your password to purchase <b>{examCount}</b> test credit{examCount === 1 ? '' : 's'} for <b>₦{total.toLocaleString('en-NG')}</b>.</span>
            </div>
            <div className="field">
              <label>Password</label>
              <PasswordInput
                placeholder="••••••••" autoFocus
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
