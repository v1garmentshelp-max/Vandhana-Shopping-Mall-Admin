import React, { useRef, useState } from 'react'
import { apiUpload } from './api'
import './EditableImage.css'

const MAX_FILE_SIZE_BYTES = 3.5 * 1024 * 1024

const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif'
]

export default function EditableImage({
  slotId,
  page,
  section,
  slotOrder,
  imageUrl,
  defaultUrl,
  altText,
  link,
  extra,
  onUpdated
}) {
  const inputRef = useRef(null)
  const [uploading, setUploading] = useState(false)

  const handleClick = (event) => {
    event.preventDefault()
    event.stopPropagation()

    if (!uploading && inputRef.current) {
      inputRef.current.click()
    }
  }

  const handleChange = async (event) => {
    const file =
      event.target.files &&
      event.target.files[0]

    if (!file) {
      return
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      alert('Please upload JPG, PNG, WEBP or AVIF image.')

      if (inputRef.current) {
        inputRef.current.value = ''
      }

      return
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      alert('File is too large. Please upload an image smaller than 3.5 MB.')

      if (inputRef.current) {
        inputRef.current.value = ''
      }

      return
    }

    try {
      setUploading(true)

      const formData = new FormData()

      formData.append('image', file)

      if (page) {
        formData.append('page', page)
      }

      if (section) {
        formData.append('section', section)
      }

      if (
        slotOrder !== undefined &&
        slotOrder !== null
      ) {
        formData.append(
          'slotOrder',
          String(slotOrder)
        )
      }

      if (defaultUrl) {
        formData.append(
          'defaultImageUrl',
          defaultUrl
        )
      }

      if (altText) {
        formData.append(
          'altText',
          altText
        )
      }

      if (link) {
        formData.append(
          'link',
          link
        )
      }

      if (extra) {
        formData.append(
          'extra',
          JSON.stringify(extra)
        )
      }

      const updated =
        await apiUpload(
          `/homepage-images/${encodeURIComponent(slotId)}/replace`,
          formData
        )

      if (onUpdated) {
        onUpdated(updated)
      }
    } catch (error) {
      const message =
        error?.payload?.message ||
        error?.message ||
        'Something went wrong while uploading. Please try again.'

      alert(message)
    } finally {
      setUploading(false)

      if (inputRef.current) {
        inputRef.current.value = ''
      }
    }
  }

  return (
    <div className="editable-image-wrapper">
      <img src={imageUrl || defaultUrl} alt={altText || ''} className="editable-image-img" />

      <div className="editable-image-overlay">
        <div className="editable-image-overlay-content">
          <span className="editable-image-badge">Editable</span>
          <button type="button" className="editable-image-btn" onClick={handleClick} disabled={uploading}>{uploading ? 'Uploading...' : 'Replace'}</button>
        </div>
      </div>

      <input ref={inputRef} type="file" accept=".jpg,.jpeg,.png,.webp,.avif,image/jpeg,image/png,image/webp,image/avif" className="editable-image-input" onChange={handleChange} />
    </div>
  )
}