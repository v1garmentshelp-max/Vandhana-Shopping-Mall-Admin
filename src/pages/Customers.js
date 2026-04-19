import React, { useState } from 'react';
import NavbarAdmin from './NavbarAdmin';
import './Customers.css';
import B2BProfiles from './B2BProfiles';
import B2CProfiles from './B2CProfiles';

const Customers = () => {
  const [activeTab, setActiveTab] = useState('B2B');

  return (
    <div className="customers-page">
      <NavbarAdmin />
      <div className="customers-container">
        <div className="profile-tabs-wrapper">
          <div className="profile-tabs">
            <button className={activeTab === 'B2B' ? 'tab-btn active' : 'tab-btn'} onClick={() => setActiveTab('B2B')} >
              B2B Profiles
            </button>
            <button className={activeTab === 'B2C' ? 'tab-btn active' : 'tab-btn'} onClick={() => setActiveTab('B2C')} >
              B2C Profiles
            </button>
          </div>
        </div>
        <div className="table-section">
          {activeTab === 'B2B' ? <B2BProfiles /> : <B2CProfiles />}
        </div>
      </div>
    </div>
  );
};

export default Customers;
