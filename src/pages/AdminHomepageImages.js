import React, { useEffect, useState } from 'react'
import NavbarAdmin from './NavbarAdmin'
import EditableImage from './EditableImage'
import './AdminHomepageImages.css'

import { Swiper, SwiperSlide } from 'swiper/react'
import { Autoplay, Pagination } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/pagination'

const API_BASE =
  process.env.REACT_APP_API_BASE_URL || 'https://vandhana-shopping-mall-backend.vercel.app'

export default function AdminHomepageImages() {
  const [remoteMap, setRemoteMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [coolTab, setCoolTab] = useState('plazzo')

  useEffect(() => {
    let isMounted = true
    const run = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/homepage-images`, { cache: 'no-store' })
        if (!res.ok) {
          if (isMounted) setLoading(false)
          return
        }
        const data = await res.json()
        const map = {}
        data.forEach((item) => {
          map[item.id] = item
        })
        if (isMounted) {
          setRemoteMap(map)
          setLoading(false)
        }
      } catch {
        if (isMounted) setLoading(false)
      }
    }
    run()
    return () => {
      isMounted = false
    }
  }, [])

  const getSlot = (path, altText, section) => {
    const rec = remoteMap[path]
    return {
      id: path,
      section: rec?.section || section || 'homepage',
      defaultUrl: path,
      imageUrl: rec?.imageUrl || path,
      altText: rec?.altText || altText
    }
  }

  const handleUpdated = (updated) => {
    setRemoteMap((prev) => ({
      ...prev,
      [updated.id]: updated
    }))
  }

  if (loading) {
    return (
      <>
        <NavbarAdmin />
        <div className="admin-homepage-page">
          <div className="admin-homepage-shell">
            <div className="admin-homepage-loading-card">
              <div className="admin-homepage-loading-spinner" />
              <h2>Loading homepage preview...</h2>
              <p>Please wait while the editor fetches the latest image slots.</p>
            </div>
          </div>
        </div>
      </>
    )
  }

  const mainHeroBanners = [
    '/images/ATTACH-BANNER.png',
    '/images/CUCUMBER-BANNER.png',
    '/images/QUICK-DRY-BANNER.png',
    '/images/JOCKEY-BANNER.png',
    '/images/TWIN-BIRDS-BANNER.png',
    '/images/INDIAN-FLOWER-BANNER.png',
    '/images/DAZZEL-BANNER.png',
    '/images/ASWATI-BANNER.png'
  ]

  const womenGrid = [
    '/images/updated/grid1.jpg',
    '/images/updated/grid2.jpg',
    '/images/updated/grid3.jpg',
    '/images/updated/grid4.jpg'
  ]

  const coolImages = {
    plazzo: [
      '/images/updated/plazzo1.webp',
      '/images/updated/plazzo2.webp',
      '/images/updated/plazzo3.webp',
      '/images/updated/plazzo4.webp'
    ],
    jeggings: [
      '/images/updated/jeggings1.webp',
      '/images/updated/jeggings2.webp',
      '/images/updated/jeggings3.webp',
      '/images/updated/jeggings4.webp'
    ],
    nightPants: [
      '/images/updated/night-pants1.webp',
      '/images/updated/night-pants4.webp',
      '/images/updated/night-pants4.webp',
      '/images/updated/night-pants4.webp'
    ],
    tshirts: [
      '/images/updated/t-shirt1.webp',
      '/images/updated/t-shirt2.webp',
      '/images/updated/t-shirt3.webp',
      '/images/updated/t-shirt4.webp'
    ]
  }

  const aurum2Items = [
    '/images/women/new/category12.png',
    '/images/women/new/category9.png',
    '/images/women/new/category10.png',
    '/images/women/new/category11.png',
    '/images/women/new/category13.png',
    '/images/women/new/category14.png',
    '/images/women/new/category15.png',
    '/images/women/new/category16.png'
  ]

  const twinBirdsMarquee = [
    '/images/women/new/category-1.png',
    '/images/women/new/category-2.png',
    '/images/women/new/category-3.png',
    '/images/women/new/category-4.png',
    '/images/women/new/category-5.png',
    '/images/women/new/category-6.png'
  ]

  const attachBanners = [
    '/images/banners/attach-banner-1.png',
    '/images/banners/attach-banner-2.png',
    '/images/banners/attach-banner-3.png',
    '/images/banners/attach-banner-4.png'
  ]

  const editorialImages = [
    '/images/updated/left.jpg',
    '/images/updated/center.jpg',
    '/images/updated/right.jpg'
  ]

  const indianFlowerPicks = [
    '/images/women/new/zig-zag3.png',
    '/images/women/new/zig-zag1.png',
    '/images/women/new/zig-zag2.png',
    '/images/women/new/zig-zag4.png',
    '/images/women/new/zig-zag5.png'
  ]

  const innerwearEssentials = [
    '/images/updated/inner1.jpg',
    '/images/updated/inner2.jpg',
    '/images/updated/inner3.jpg',
    '/images/updated/inner5.jpg'
  ]

  const mensJockey = [
    '/images/home/jockey2.webp',
    '/images/home/jockey3.webp',
    '/images/home/jockey4.webp',
    '/images/home/jockey5.webp',
    '/images/home/jockey6.webp',
    '/images/home/jockey7.webp',
    '/images/home/jockey8.webp',
    '/images/home/jockey9.webp'
  ]

  const mensDaily = [
    '/images/updated/men1.jpg',
    '/images/updated/men2.jpg',
    '/images/updated/men3.jpg',
    '/images/updated/men4.jpg',
    '/images/updated/men5.jpg',
    '/images/updated/men6.jpg',
    '/images/updated/men7.jpg'
  ]

  return (
    <>
      <NavbarAdmin />
      <div className="admin-homepage-page">
        <div className="admin-homepage-shell">
          <div className="admin-homepage-topbar">
            <div>
              <span className="admin-homepage-badge">Homepage Editor</span>
              <h1 className="admin-homepage-heading">Homepage image manager</h1>
              <p className="admin-homepage-subheading">
                Click any image card to replace it. All sections are grouped for easier editing and cleaner workflow.
              </p>
            </div>
          </div>

          <div className="admin-homepage-spacer">
            <section className="admin-homepage-section">
              <div className="admin-homepage-section-head">
                <h2 className="admin-homepage-section-title">1. Main Hero Banners</h2>
                <p className="admin-homepage-section-note">Primary homepage hero slider</p>
              </div>
              <div className="admin-homepage-banner-frame large">
                <Swiper
                  modules={[Autoplay, Pagination]}
                  loop
                  slidesPerView={1}
                  autoplay={{ delay: 3500 }}
                  pagination={{ clickable: true }}
                >
                  {mainHeroBanners.map((path, i) => {
                    const slot = getSlot(path, `Hero ${i}`, 'Main Hero')
                    return (
                      <SwiperSlide key={path}>
                        <div className="admin-homepage-banner-slide">
                          <EditableImage
                            slotId={slot.id}
                            section={slot.section}
                            imageUrl={slot.imageUrl}
                            defaultUrl={slot.defaultUrl}
                            altText={slot.altText}
                            onUpdated={handleUpdated}
                          />
                        </div>
                      </SwiperSlide>
                    )
                  })}
                </Swiper>
              </div>
            </section>

            <section className="admin-homepage-section">
              <div className="admin-homepage-section-head">
                <h2 className="admin-homepage-section-title">2. Women's Category Grid</h2>
                <p className="admin-homepage-section-note">Main women category highlights</p>
              </div>
              <div className="admin-homepage-grid grid-4">
                {womenGrid.map((path, i) => {
                  const slot = getSlot(path, `Women Grid ${i}`, 'Category Grid')
                  return (
                    <div className="admin-homepage-card standard" key={path}>
                      <EditableImage
                        slotId={slot.id}
                        section={slot.section}
                        imageUrl={slot.imageUrl}
                        defaultUrl={slot.defaultUrl}
                        altText={slot.altText}
                        onUpdated={handleUpdated}
                      />
                    </div>
                  )
                })}
              </div>
            </section>

            <section className="admin-homepage-section">
              <div className="admin-homepage-section-head">
                <h2 className="admin-homepage-section-title">3. Stay Cool in Style</h2>
                <p className="admin-homepage-section-note">Tabbed image collection by category</p>
              </div>
              <div className="admin-homepage-tabs">
                {Object.keys(coolImages).map((tab) => (
                  <button
                    key={tab}
                    className={`admin-homepage-tab ${coolTab === tab ? 'active' : ''}`}
                    onClick={() => setCoolTab(tab)}
                  >
                    {tab.toUpperCase()}
                  </button>
                ))}
              </div>
              <div className="admin-homepage-grid grid-4">
                {coolImages[coolTab].map((src, i) => {
                  const slot = getSlot(src, `Cool ${coolTab} ${i}`, 'Cool Tabs')
                  return (
                    <div className="admin-homepage-card standard" key={`${src}-${i}`}>
                      <EditableImage
                        slotId={slot.id}
                        section={slot.section}
                        imageUrl={slot.imageUrl}
                        defaultUrl={slot.defaultUrl}
                        altText={slot.altText}
                        onUpdated={handleUpdated}
                      />
                    </div>
                  )
                })}
              </div>
            </section>

            <section className="admin-homepage-section">
              <div className="admin-homepage-section-head">
                <h2 className="admin-homepage-section-title">4. Women's Categories Explore</h2>
                <p className="admin-homepage-section-note">Expanded women's category cards</p>
              </div>
              <div className="admin-homepage-grid grid-4">
                {aurum2Items.map((path, i) => {
                  const slot = getSlot(path, `Aurum Category ${i}`, "Women's Categories")
                  return (
                    <div className="admin-homepage-card standard" key={path}>
                      <EditableImage
                        slotId={slot.id}
                        section={slot.section}
                        imageUrl={slot.imageUrl}
                        defaultUrl={slot.defaultUrl}
                        altText={slot.altText}
                        onUpdated={handleUpdated}
                      />
                    </div>
                  )
                })}
              </div>
            </section>

            <section className="admin-homepage-section">
              <div className="admin-homepage-section-head">
                <h2 className="admin-homepage-section-title">5. Twin Birds Marquee</h2>
                <p className="admin-homepage-section-note">Remaining marquee assets</p>
              </div>
              <div className="admin-homepage-grid grid-6">
                {twinBirdsMarquee.map((path, i) => {
                  const slot = getSlot(path, `Marquee ${i}`, 'Twin Birds Marquee')
                  return (
                    <div className="admin-homepage-card square" key={path}>
                      <EditableImage
                        slotId={slot.id}
                        section={slot.section}
                        imageUrl={slot.imageUrl}
                        defaultUrl={slot.defaultUrl}
                        altText={slot.altText}
                        onUpdated={handleUpdated}
                      />
                    </div>
                  )
                })}
              </div>
            </section>

            <section className="admin-homepage-section narrow-section">
              <div className="admin-homepage-section-head">
                <h2 className="admin-homepage-section-title">6. Popular Brands Side Photo</h2>
                <p className="admin-homepage-section-note">Single support visual</p>
              </div>
              <div className="admin-homepage-card standard">
                <EditableImage
                  slotId="/images/contact-side.jpg"
                  section="Popular Brands"
                  imageUrl={getSlot('/images/contact-side.jpg').imageUrl}
                  defaultUrl="/images/contact-side.jpg"
                  altText="Contact Side"
                  onUpdated={handleUpdated}
                />
              </div>
            </section>

            <section className="admin-homepage-section">
              <div className="admin-homepage-section-head">
                <h2 className="admin-homepage-section-title">7. Secondary Banners</h2>
                <p className="admin-homepage-section-note">Attach banner slider section</p>
              </div>
              <div className="admin-homepage-banner-frame medium">
                <Swiper
                  modules={[Autoplay]}
                  loop
                  slidesPerView={1}
                  autoplay={{ delay: 3500 }}
                >
                  {attachBanners.map((path, i) => {
                    const slot = getSlot(path, `Attach Banner ${i}`, 'Secondary Banners')
                    return (
                      <SwiperSlide key={path}>
                        <div className="admin-homepage-banner-slide">
                          <EditableImage
                            slotId={slot.id}
                            section={slot.section}
                            imageUrl={slot.imageUrl}
                            defaultUrl={slot.defaultUrl}
                            altText={slot.altText}
                            onUpdated={handleUpdated}
                          />
                        </div>
                      </SwiperSlide>
                    )
                  })}
                </Swiper>
              </div>
            </section>

            <section className="admin-homepage-section">
              <div className="admin-homepage-section-head">
                <h2 className="admin-homepage-section-title">8. Editorial Images</h2>
                <p className="admin-homepage-section-note">Three feature editorial cards</p>
              </div>
              <div className="admin-homepage-grid grid-3">
                {editorialImages.map((path, i) => {
                  const slot = getSlot(path, `Editorial ${i}`, 'Editorial')
                  return (
                    <div className="admin-homepage-card standard" key={path}>
                      <EditableImage
                        slotId={slot.id}
                        section={slot.section}
                        imageUrl={slot.imageUrl}
                        defaultUrl={slot.defaultUrl}
                        altText={slot.altText}
                        onUpdated={handleUpdated}
                      />
                    </div>
                  )
                })}
              </div>
            </section>

            <section className="admin-homepage-section">
              <div className="admin-homepage-section-head">
                <h2 className="admin-homepage-section-title">9. Indian Flower Picks</h2>
                <p className="admin-homepage-section-note">Zig zag feature product visuals</p>
              </div>
              <div className="admin-homepage-grid grid-5">
                {indianFlowerPicks.map((path, i) => {
                  const slot = getSlot(path, `Indian Flower ${i}`, 'Indian Flower')
                  return (
                    <div className="admin-homepage-card standard" key={path}>
                      <EditableImage
                        slotId={slot.id}
                        section={slot.section}
                        imageUrl={slot.imageUrl}
                        defaultUrl={slot.defaultUrl}
                        altText={slot.altText}
                        onUpdated={handleUpdated}
                      />
                    </div>
                  )
                })}
              </div>
            </section>

            <section className="admin-homepage-section">
              <div className="admin-homepage-section-head">
                <h2 className="admin-homepage-section-title">10. Innerwear Essentials</h2>
                <p className="admin-homepage-section-note">Square essentials section cards</p>
              </div>
              <div className="admin-homepage-grid grid-4">
                {innerwearEssentials.map((path, i) => {
                  const slot = getSlot(path, `Innerwear ${i}`, 'Innerwear Essentials')
                  return (
                    <div className="admin-homepage-card square" key={path}>
                      <EditableImage
                        slotId={slot.id}
                        section={slot.section}
                        imageUrl={slot.imageUrl}
                        defaultUrl={slot.defaultUrl}
                        altText={slot.altText}
                        onUpdated={handleUpdated}
                      />
                    </div>
                  )
                })}
              </div>
            </section>

            <section className="admin-homepage-section">
              <div className="admin-homepage-section-head">
                <h2 className="admin-homepage-section-title">11. Men's Essentials</h2>
                <p className="admin-homepage-section-note">
                  These images are reused for round icons and supporting product picks.
                </p>
              </div>
              <div className="admin-homepage-grid grid-6">
                {mensJockey.map((path, i) => {
                  const slot = getSlot(path, `Jockey Mens ${i}`, 'Mens Essentials')
                  return (
                    <div className="admin-homepage-card circle" key={path}>
                      <EditableImage
                        slotId={slot.id}
                        section={slot.section}
                        imageUrl={slot.imageUrl}
                        defaultUrl={slot.defaultUrl}
                        altText={slot.altText}
                        onUpdated={handleUpdated}
                      />
                    </div>
                  )
                })}
              </div>
            </section>

            <section className="admin-homepage-section">
              <div className="admin-homepage-section-head">
                <h2 className="admin-homepage-section-title">12. Men's Daily Essentials</h2>
                <p className="admin-homepage-section-note">Daily wear feature collection</p>
              </div>
              <div className="admin-homepage-grid grid-4">
                {mensDaily.map((path, i) => {
                  const slot = getSlot(path, `Mens Daily ${i}`, 'Mens Daily')
                  return (
                    <div className="admin-homepage-card standard" key={path}>
                      <EditableImage
                        slotId={slot.id}
                        section={slot.section}
                        imageUrl={slot.imageUrl}
                        defaultUrl={slot.defaultUrl}
                        altText={slot.altText}
                        onUpdated={handleUpdated}
                      />
                    </div>
                  )
                })}
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  )
}