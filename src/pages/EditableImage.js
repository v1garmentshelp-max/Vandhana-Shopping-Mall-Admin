import React, { useRef, useState } from 'react'
import './EditableImage.css'

const API_BASE = process.env.REACT_APP_API_BASE_URL || 'https://vandhana-shopping-mall-backend.vercel.app'
const MAX_FILE_SIZE_BYTES = 3.5 * 1024 * 1024

export default function EditableImage({ slotId, section, imageUrl, defaultUrl, altText, onUpdated }) {
  const inputRef = useRef(null)
  const [uploading, setUploading] = useState(false)

  const handleClick = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (inputRef.current) inputRef.current.click()
  }

  const handleChange = async (e) => {
    const file = e.target.files && e.target.files[0]
    if (!file) return

    if (file.size > MAX_FILE_SIZE_BYTES) {
      alert('File is too large. Please upload an image smaller than 3.5 MB.')
      if (inputRef.current) inputRef.current.value = ''
      return
    }

    try {
      setUploading(true)

      const formData = new FormData()
      formData.append('image', file)

      const uploadRes = await fetch(`${API_BASE}/api/upload`, {
        method: 'POST',
        body: formData
      })

      if (!uploadRes.ok) {
        if (uploadRes.status === 413) {
          alert('Image is too large for the server. Please upload a smaller image under 3.5 MB.')
        } else {
          alert('Failed to upload image.')
        }
        setUploading(false)
        return
      }

      const uploadJson = await uploadRes.json()
      const newImageUrl = uploadJson.imageUrl

      const body = {
        section: section || null,
        imageUrl: newImageUrl,
        altText: altText || '',
        link: null,
        extra: null
      }

      const patchRes = await fetch(`${API_BASE}/api/homepage-images/${encodeURIComponent(slotId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (!patchRes.ok) {
        alert('Failed to save homepage image mapping.')
        setUploading(false)
        return
      }

      const updated = await patchRes.json()
      if (onUpdated) onUpdated(updated)
    } catch {
      alert('Something went wrong while uploading. Please try again.')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const label = uploading ? 'Uploading...' : 'Replace'

  return (
    <div className="editable-image-wrapper">
      <img
        src={imageUrl || defaultUrl}
        alt={altText || ''}
        className="editable-image-img"
      />

      <div className="editable-image-overlay">
        <div className="editable-image-overlay-content">
          <span className="editable-image-badge">Editable</span>
          <button
            type="button"
            className="editable-image-btn"
            onClick={handleClick}
            disabled={uploading}
          >
            {label}
          </button>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="editable-image-input"
        onChange={handleChange}
      />
    </div>
  )
}