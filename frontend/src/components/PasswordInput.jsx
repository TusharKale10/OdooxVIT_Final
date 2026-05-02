import { useState } from 'react';

export default function PasswordInput({ value, onChange, required, minLength = 6, placeholder, autoComplete = 'current-password', name = 'password' }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        required={required}
        minLength={minLength}
        placeholder={placeholder}
        autoComplete={autoComplete}
        name={name}
        style={{ paddingRight: 64, width: '100%' }}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Hide password' : 'Show password'}
        style={{
          position: 'absolute',
          right: 6, top: '50%',
          transform: 'translateY(-50%)',
          background: 'transparent',
          color: 'var(--text-muted)',
          padding: '6px 10px',
          fontSize: 12,
          fontWeight: 600,
          boxShadow: 'none',
          letterSpacing: '0.04em',
        }}
      >
        {show ? 'HIDE' : 'SHOW'}
      </button>
    </div>
  );
}
