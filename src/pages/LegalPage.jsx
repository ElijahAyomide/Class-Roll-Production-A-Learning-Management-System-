import React from 'react';
import { Link } from 'react-router-dom';

const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL || '';
const UPDATED = 'October 2026';

function Shell({ title, children }) {
  return (
    <div className="legal-page">
      <div className="legal-wrap">
        <Link to="/login" className="legal-back">← Back to Assessly</Link>
        <h1>{title}</h1>
        <div className="legal-updated">Last updated: {UPDATED}</div>
        {children}
        <h2>Contact</h2>
        <p>
          Questions about this page? {SUPPORT_EMAIL
            ? <>Email us at <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</>
            : 'Please contact your school administrator or Assessly support.'}
        </p>
      </div>
    </div>
  );
}

export function TermsPage() {
  return (
    <Shell title="Terms of service">
      <h2>1. About Assessly</h2>
      <p>Assessly is a computer-based testing service for schools. A school registers an account, adds its students and questions, and students take tests from their own login.</p>
      <h2>2. Your account</h2>
      <p>The person who registers a school is responsible for the account, for keeping the password safe, and for what happens under it. Please give accurate information and tell us if you think someone else has gained access.</p>
      <h2>3. Acceptable use</h2>
      <p>Use Assessly only for genuine school tests. Do not try to break into other schools' data, interfere with the service, or share student login details with people who should not have them.</p>
      <h2>4. Test credits and payments</h2>
      <p>Tests are paid for with test credits, bought through our payment partner (Paystack). One credit covers one subject for one student. Credits used to set a test cannot be refunded once the student has been given the test.</p>
      <h2>5. School content</h2>
      <p>Questions, student lists and results you add belong to your school. You allow Assessly to store and process them so the service works.</p>
      <h2>6. Availability</h2>
      <p>We work to keep Assessly running, but we cannot promise it will always be uninterrupted. Schools should plan tests with that in mind.</p>
      <h2>7. Changes</h2>
      <p>We may update these terms from time to time. Continuing to use Assessly after a change means you accept the updated terms.</p>
    </Shell>
  );
}

export function PrivacyPage() {
  return (
    <Shell title="Privacy policy">
      <h2>What we collect</h2>
      <p>For the school administrator: name, school name and code, phone number, email address and password (stored securely, never in plain text). For students: name, class, subjects, a generated username, their test answers and their results. Payments are handled by Paystack; we do not see or store card details.</p>
      <h2>How we use it</h2>
      <p>To run tests, mark them, show results to the school, send account emails (such as verification and password reset), and keep the service secure.</p>
      <h2>Who can see it</h2>
      <p>A school can see only its own students and results. Students can only see their own test while they are taking it; they are not shown scores. We do not sell personal data. We use trusted providers to run the service (for hosting, the database, email and payments), and they handle data only to provide those services.</p>
      <h2>Students and children</h2>
      <p>Student information is added by the school, which is responsible for having the right to share it with Assessly.</p>
      <h2>Keeping and deleting data</h2>
      <p>We keep data while a school's account is active. A school can ask us to delete its data, and students can ask their school to correct or remove their information.</p>
      <h2>Your rights</h2>
      <p>You can ask to see, correct or delete personal data we hold about you. We handle personal data in line with applicable Nigerian data protection law.</p>
    </Shell>
  );
}
