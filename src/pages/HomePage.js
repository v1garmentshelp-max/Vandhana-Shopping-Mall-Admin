// D:\shopping-admin\src\pages\HomePage.js
import React, { useState } from 'react';
import './HomePage.css';
import Navbar from './NavbarAdmin';
import AddProduct from './AddProduct';
import UpdateProduct from './UpdateProduct';
import DeleteProduct from './DeleteProduct';

const HomePage = () => {
  const [activeTab, setActiveTab] = useState('Add');

  const renderContent = () => {
    if (activeTab === 'Add') return <AddProduct />;
    if (activeTab === 'Update') return <UpdateProduct />;
    if (activeTab === 'Delete') return <DeleteProduct />;
    return null;
  };

  return (
    <div className="admin-homepage">
      <Navbar active="Products" />
      <div className="admin-body">
        <div className="admin-sidebar">
          <button
            className={`sidebar-button ${activeTab === 'Add' ? 'active' : ''}`}
            onClick={() => setActiveTab('Add')}
          >
            <span>Add Product</span>
          </button>

          <button
            className={`sidebar-button ${activeTab === 'Update' ? 'active' : ''}`}
            onClick={() => setActiveTab('Update')}
          >
            <span>Update Product</span>
          </button>

          <button
            className={`sidebar-button ${activeTab === 'Delete' ? 'active' : ''}`}
            onClick={() => setActiveTab('Delete')}
          >
            <span>Delete Product</span>
          </button>
        </div>
        <div className="admin-main">{renderContent()}</div>
      </div>
    </div>
  );
};

export default HomePage;
