import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

// A password box with an eye button that shows or hides what was typed,
// so people can check they've entered it correctly. Accepts everything a
// normal <input> does (value, onChange, placeholder, autoFocus, …).
export default function PasswordInput({ slashWhenHidden = false, ...props }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="password-wrap">
      <input {...props} type={visible ? 'text' : 'password'} />
      <button
        type="button"
        className="password-toggle"
        onClick={() => setVisible(v => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        title={visible ? 'Hide password' : 'Show password'}
      >
        {(slashWhenHidden ? !visible : visible) ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}
