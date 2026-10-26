import React from 'react';
import { X } from 'lucide-react';

export default function Modal({ title, onClose, children, width = 460 }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" style={{ maxWidth: `${width / 16}em` }} onClick={e => e.stopPropagation()}>
        <div className="modal-panel-header">
          <span>{title}</span>
          <button onClick={onClose} aria-label="Close" className="modal-close-btn"><X size={16} /></button>
        </div>
        <div className="modal-panel-body">{children}</div>
      </div>
    </div>
  );
}
