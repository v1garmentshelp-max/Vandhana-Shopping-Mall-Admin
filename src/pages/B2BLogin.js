import React, { useRef, useEffect } from 'react';
import './B2BLogin.css';

const B2BLogin = ({
  name,
  email,
  mobile,
  password,
  confirmPassword,
  setName,
  setEmail,
  setMobile,
  setPassword,
  setConfirmPassword,
  handleSubmit,
  onClose,
}) => {
  const popupRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target)) {
        onClose();
      }
    };

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const onSubmit = (e) => {
    e.preventDefault();
    handleSubmit();
  };

  return (
    <div className="popup-overlay" role="dialog" aria-modal="true" aria-labelledby="b2b-login-title">
      <div className="popup-box" ref={popupRef}>
        <button type="button" className="popup-close" onClick={onClose} aria-label="Close">
          ×
        </button>

        <div className="popup-header">
          <span className="popup-badge">B2B Customer</span>
          <h3 id="b2b-login-title">Add New User</h3>
          <p>Create a wholesale customer account with login access.</p>
        </div>

        <form className="popup-form" onSubmit={onSubmit}>
          <div className="popup-field">
            <label htmlFor="b2b-name">Full Name</label>
            <input
              id="b2b-name"
              type="text"
              placeholder="Enter full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="popup-field">
            <label htmlFor="b2b-email">Email</label>
            <input
              id="b2b-email"
              type="email"
              placeholder="Enter email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="popup-field">
            <label htmlFor="b2b-mobile">Mobile Number</label>
            <input
              id="b2b-mobile"
              type="tel"
              placeholder="Enter mobile number"
              maxLength="10"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
            />
          </div>

          <div className="popup-field">
            <label htmlFor="b2b-password">Password</label>
            <input
              id="b2b-password"
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="popup-field">
            <label htmlFor="b2b-confirm-password">Confirm Password</label>
            <input
              id="b2b-confirm-password"
              type="password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          <div className="popup-actions">
            <button type="button" className="cancel-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="submit-btn">
              Submit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default B2BLogin;