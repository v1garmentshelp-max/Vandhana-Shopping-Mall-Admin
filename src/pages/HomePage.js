import React, { useState } from 'react'
import './HomePage.css'
import Navbar from './NavbarAdmin'
import AddProduct from './AddProduct'
import UpdateProduct from './UpdateProduct'
import DeleteProduct from './DeleteProduct'

const HomePage = () => {
  const [activeTab, setActiveTab] = useState('Add')

  const renderContent = () => {
    if (activeTab === 'Add') return <AddProduct />
    if (activeTab === 'Update') return <UpdateProduct />
    if (activeTab === 'Delete') return <DeleteProduct />
    return null
  }

  return (
    <div className="admin-homepage-vandana">
      <Navbar active="Products" />
      <div className="admin-body-vandana">
        <div className="admin-sidebar-vandana">
          <button
            className={`sidebar-button-vandana ${activeTab === 'Add' ? 'active-vandana' : ''}`}
            onClick={() => setActiveTab('Add')}
          >
            <span>Add Product</span>
          </button>

          <button
            className={`sidebar-button-vandana ${activeTab === 'Update' ? 'active-vandana' : ''}`}
            onClick={() => setActiveTab('Update')}
          >
            <span>Update Product</span>
          </button>

          <button
            className={`sidebar-button-vandana ${activeTab === 'Delete' ? 'active-vandana' : ''}`}
            onClick={() => setActiveTab('Delete')}
          >
            <span>Delete Product</span>
          </button>
        </div>

        <div className="admin-main-vandana">{renderContent()}</div>
      </div>
    </div>
  )
}

export default HomePage