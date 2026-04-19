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

  const handleClickOutside = (e) => {
    if (popupRef.current && !popupRef.current.contains(e.target)) {
      onClose();
    }
  };

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="popup-overlay">
      <div className="popup-box" ref={popupRef}>
        <div className="popup-close" onClick={onClose}>×</div>
        <h3>Add New User</h3>

        <label>Full Name</label>
        <input type="text" placeholder="Full Name" value={name} onChange={(e) => setName(e.target.value)} />

        <label>Email</label>
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />

        <label>Mobile Number</label>
        <input type="tel" placeholder="Mobile Number" maxLength="10" value={mobile} onChange={(e) => setMobile(e.target.value)} />

        <label>Password</label>
        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />

        <label>Confirm Password</label>
        <input type="password" placeholder="Confirm Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />

        <button className="submit-btn" onClick={handleSubmit}>Submit</button>
      </div>
    </div>
  );
};

export default B2BLogin;
