import React, {
  useCallback,
  useEffect,
  useMemo,
  useState
} from 'react'
import Navbar from './NavbarAdmin'
import { apiGet } from './api'
import './RewardPoints.css'

const number = value => {
  const parsed = Number(value)
  return Number.isFinite(parsed)
    ? parsed
    : 0
}

const formatNumber = value =>
  number(value).toLocaleString('en-IN')

const formatDate = value => {
  if (!value) return '-'

  const date = new Date(value)

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return '-'
  }

  return date.toLocaleDateString(
    'en-IN',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }
  )
}

const formatDateTime = value => {
  if (!value) return '-'

  const date = new Date(value)

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return '-'
  }

  return date.toLocaleString(
    'en-IN',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }
  )
}

const transactionLabel = type => {
  const value = String(
    type || ''
  ).toUpperCase()

  if (
    value ===
    'SIGNUP_BONUS'
  ) {
    return 'Signup Bonus'
  }

  if (
    value === 'REDEEMED'
  ) {
    return 'Redeemed'
  }

  if (
    value === 'EXPIRED'
  ) {
    return 'Expired'
  }

  if (
    value === 'REFUNDED'
  ) {
    return 'Refunded'
  }

  if (
    value ===
    'ADJUSTMENT_CREDIT'
  ) {
    return 'Credit'
  }

  if (
    value ===
    'ADJUSTMENT_DEBIT'
  ) {
    return 'Debit'
  }

  return (
    value.replace(
      /_/g,
      ' '
    ) || '-'
  )
}

const transactionClass = type => {
  const value = String(
    type || ''
  ).toUpperCase()

  if (
    value ===
      'SIGNUP_BONUS' ||
    value ===
      'REFUNDED' ||
    value ===
      'ADJUSTMENT_CREDIT'
  ) {
    return 'credit'
  }

  if (
    value ===
      'REDEEMED' ||
    value ===
      'ADJUSTMENT_DEBIT'
  ) {
    return 'redeemed'
  }

  if (
    value === 'EXPIRED'
  ) {
    return 'expired'
  }

  return 'neutral'
}

const RewardPoints = () => {
  const [summary, setSummary] =
    useState(null)

  const [users, setUsers] =
    useState([])

  const [search, setSearch] =
    useState('')

  const [searchInput, setSearchInput] =
    useState('')

  const [page, setPage] =
    useState(1)

  const [totalPages, setTotalPages] =
    useState(1)

  const [totalUsers, setTotalUsers] =
    useState(0)

  const [loading, setLoading] =
    useState(true)

  const [usersLoading, setUsersLoading] =
    useState(false)

  const [error, setError] =
    useState('')

  const [
    selectedUserId,
    setSelectedUserId
  ] = useState(null)

  const [
    selectedDetail,
    setSelectedDetail
  ] = useState(null)

  const [
    detailLoading,
    setDetailLoading
  ] = useState(false)

  const [detailError, setDetailError] =
    useState('')

  const metrics =
    summary?.metrics || {}

  const settings =
    summary?.settings || {}

  const loadSummary =
    useCallback(async () => {
      const data =
        await apiGet(
          '/rewards/admin/summary'
        )

      setSummary(data)
    }, [])

  const loadUsers =
    useCallback(async () => {
      setUsersLoading(true)

      try {
        const data =
          await apiGet(
            '/rewards/admin/users',
            {
              search,
              page,
              limit: 50
            }
          )

        setUsers(
          Array.isArray(
            data?.users
          )
            ? data.users
            : []
        )

        setTotalPages(
          Math.max(
            number(
              data?.total_pages
            ),
            1
          )
        )

        setTotalUsers(
          number(
            data?.total
          )
        )
      } finally {
        setUsersLoading(false)
      }
    }, [search, page])

  useEffect(() => {
    let active = true

    const load = async () => {
      setLoading(true)
      setError('')

      try {
        await Promise.all([
          loadSummary(),
          loadUsers()
        ])
      } catch (err) {
        if (active) {
          setError(
            err?.message ||
              'Unable to load reward points'
          )
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      active = false
    }
  }, [loadSummary, loadUsers])

  const refreshAll = async () => {
    setError('')
    setLoading(true)

    try {
      await Promise.all([
        loadSummary(),
        loadUsers()
      ])
    } catch (err) {
      setError(
        err?.message ||
          'Unable to refresh rewards'
      )
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = event => {
    event.preventDefault()

    setPage(1)
    setSearch(
      searchInput.trim()
    )
  }

  const clearSearch = () => {
    setSearchInput('')
    setSearch('')
    setPage(1)
  }

  const openUser = async userId => {
    setSelectedUserId(
      userId
    )

    setSelectedDetail(null)
    setDetailError('')
    setDetailLoading(true)

    try {
      const data =
        await apiGet(
          `/rewards/admin/users/${userId}`
        )

      setSelectedDetail(
        data
      )
    } catch (err) {
      setDetailError(
        err?.message ||
          'Unable to load customer rewards'
      )
    } finally {
      setDetailLoading(false)
    }
  }

  const closeUser = () => {
    setSelectedUserId(null)
    setSelectedDetail(null)
    setDetailError('')
  }

  const statusForUser = user => {
    if (
      number(
        user.balance
      ) <= 0
    ) {
      return {
        label:
          'No Active Points',
        className: 'empty'
      }
    }

    if (user.hurry_up) {
      return {
        label: 'Hurry Up',
        className: 'warning'
      }
    }

    return {
      label: 'Active',
      className: 'active'
    }
  }

  const detailWallet =
    selectedDetail?.wallet ||
    null

  const history =
    Array.isArray(
      selectedDetail?.history
    )
      ? selectedDetail.history
      : []

  const detailActiveLots =
    Array.isArray(
      detailWallet?.active_lots
    )
      ? detailWallet.active_lots
      : []

  const cards = useMemo(
    () => [
      {
        label: 'B2C Customers',
        value: formatNumber(
          metrics.total_b2c_customers
        ),
        detail: 'Registered customers'
      },
      {
        label: 'Active Points',
        value: formatNumber(
          metrics.active_points
        ),
        detail: `${formatNumber(
          metrics.users_with_active_points
        )} customers`
      },
      {
        label: 'Expiring Soon',
        value: formatNumber(
          metrics.expiring_soon_points
        ),
        detail: `Within ${number(
          settings.warning_days
        )} days`
      },
      {
        label: 'Redeemed',
        value: formatNumber(
          metrics.redeemed_points
        ),
        detail: 'Total points used'
      },
      {
        label: 'Expired',
        value: formatNumber(
          metrics.expired_points
        ),
        detail: 'Expired points'
      },
      {
        label: 'Refunded',
        value: formatNumber(
          metrics.refunded_points
        ),
        detail: 'Points restored'
      }
    ],
    [
      metrics,
      settings.warning_days
    ]
  )

  return (
    <div className="rewards-page">
      <Navbar />

      <main className="rewards-shell">
        <section className="rewards-hero">
          <div>
            <span className="rewards-eyebrow">
              Customer Loyalty
            </span>

            <h1>
              Reward Points
            </h1>

            <p>
              Monitor signup rewards,
              active balances,
              redemptions and expiry
              status.
            </p>
          </div>

          <button
            type="button"
            className="rewards-refresh-btn"
            onClick={refreshAll}
            disabled={loading}
          >
            {loading
              ? 'Refreshing...'
              : 'Refresh'}
          </button>
        </section>

        {error ? (
          <div className="rewards-alert">
            {error}
          </div>
        ) : null}

        <section className="rewards-settings">
          <div className="rewards-setting">
            <span>
              Reward System
            </span>

            <strong
              className={
                settings.enabled
                  ? 'enabled'
                  : 'disabled'
              }
            >
              {settings.enabled
                ? 'Enabled'
                : 'Disabled'}
            </strong>
          </div>

          <div className="rewards-setting">
            <span>
              Signup Bonus
            </span>

            <strong>
              {formatNumber(
                settings.signup_bonus_points
              )}{' '}
              points
            </strong>
          </div>

          <div className="rewards-setting">
            <span>
              Validity
            </span>

            <strong>
              {formatNumber(
                settings.validity_days
              )}{' '}
              days
            </strong>
          </div>

          <div className="rewards-setting">
            <span>
              Hurry Up Warning
            </span>

            <strong>
              {formatNumber(
                settings.warning_days
              )}{' '}
              days
            </strong>
          </div>
        </section>

        <section className="rewards-summary-grid">
          {cards.map(card => (
            <article
              className="rewards-summary-card"
              key={card.label}
            >
              <span>
                {card.label}
              </span>

              <strong>
                {card.value}
              </strong>

              <small>
                {card.detail}
              </small>
            </article>
          ))}
        </section>

        <section className="rewards-panel">
          <div className="rewards-panel-header">
            <div>
              <span className="rewards-eyebrow">
                Customer Wallets
              </span>

              <h2>
                Reward Balances
              </h2>

              <p>
                {formatNumber(
                  totalUsers
                )}{' '}
                customers
              </p>
            </div>

            <form
              className="rewards-search"
              onSubmit={handleSearch}
            >
              <input
                value={searchInput}
                onChange={event =>
                  setSearchInput(
                    event.target.value
                  )
                }
                placeholder="Search name, email or mobile"
              />

              {searchInput ||
              search ? (
                <button
                  type="button"
                  className="rewards-clear-search"
                  onClick={clearSearch}
                >
                  Clear
                </button>
              ) : null}

              <button
                type="submit"
                className="rewards-search-btn"
              >
                Search
              </button>
            </form>
          </div>

          <div className="rewards-table-wrap">
            <table className="rewards-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Mobile</th>
                  <th>Balance</th>
                  <th>Expiring Soon</th>
                  <th>Nearest Expiry</th>
                  <th>Days Left</th>
                  <th>Redeemed</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {usersLoading ? (
                  <tr>
                    <td
                      colSpan="9"
                      className="rewards-table-message"
                    >
                      Loading reward
                      wallets...
                    </td>
                  </tr>
                ) : users.length ===
                  0 ? (
                  <tr>
                    <td
                      colSpan="9"
                      className="rewards-table-message"
                    >
                      No customers found
                    </td>
                  </tr>
                ) : (
                  users.map(user => {
                    const status =
                      statusForUser(
                        user
                      )

                    return (
                      <tr key={user.id}>
                        <td>
                          <div className="rewards-user-cell">
                            <div className="rewards-avatar">
                              {String(
                                user.name ||
                                  user.email ||
                                  'U'
                              )
                                .charAt(0)
                                .toUpperCase()}
                            </div>

                            <div>
                              <strong>
                                {user.name ||
                                  'Customer'}
                              </strong>

                              <span>
                                {user.email}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td>
                          {user.mobile ||
                            '-'}
                        </td>

                        <td>
                          <strong className="rewards-balance">
                            {formatNumber(
                              user.balance
                            )}
                          </strong>
                        </td>

                        <td>
                          {formatNumber(
                            user.expiring_soon_points
                          )}
                        </td>

                        <td>
                          {formatDate(
                            user.nearest_expiry
                          )}
                        </td>

                        <td>
                          {user.days_remaining ==
                          null
                            ? '-'
                            : `${user.days_remaining} day${
                                user.days_remaining ===
                                1
                                  ? ''
                                  : 's'
                              }`}
                        </td>

                        <td>
                          {formatNumber(
                            user.redeemed_points
                          )}
                        </td>

                        <td>
                          <span
                            className={`rewards-status ${status.className}`}
                          >
                            {
                              status.label
                            }
                          </span>
                        </td>

                        <td>
                          <button
                            type="button"
                            className="rewards-view-btn"
                            onClick={() =>
                              openUser(
                                user.id
                              )
                            }
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="rewards-pagination">
            <button
              type="button"
              disabled={
                page <= 1 ||
                usersLoading
              }
              onClick={() =>
                setPage(current =>
                  Math.max(
                    current - 1,
                    1
                  )
                )
              }
            >
              Previous
            </button>

            <span>
              Page {page} of{' '}
              {totalPages}
            </span>

            <button
              type="button"
              disabled={
                page >= totalPages ||
                usersLoading
              }
              onClick={() =>
                setPage(current =>
                  Math.min(
                    current + 1,
                    totalPages
                  )
                )
              }
            >
              Next
            </button>
          </div>
        </section>
      </main>

      {selectedUserId ? (
        <div
          className="rewards-modal-overlay"
          onMouseDown={event => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeUser()
            }
          }}
        >
          <div className="rewards-modal">
            <div className="rewards-modal-header">
              <div>
                <span className="rewards-eyebrow">
                  Customer Rewards
                </span>

                <h2>
                  {selectedDetail
                    ?.user?.name ||
                    'Reward Details'}
                </h2>

                <p>
                  {selectedDetail
                    ?.user?.email ||
                    ''}
                </p>
              </div>

              <button
                type="button"
                className="rewards-modal-close"
                onClick={closeUser}
              >
                ×
              </button>
            </div>

            {detailLoading ? (
              <div className="rewards-detail-loading">
                Loading customer
                rewards...
              </div>
            ) : detailError ? (
              <div className="rewards-alert">
                {detailError}
              </div>
            ) : selectedDetail ? (
              <>
                <section className="rewards-wallet-overview">
                  <div>
                    <span>
                      Active Balance
                    </span>

                    <strong>
                      {formatNumber(
                        detailWallet
                          ?.balance
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Expiring Soon
                    </span>

                    <strong>
                      {formatNumber(
                        detailWallet
                          ?.expiring_soon_points
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Nearest Expiry
                    </span>

                    <strong>
                      {formatDate(
                        detailWallet
                          ?.nearest_expiry
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Days Left
                    </span>

                    <strong>
                      {detailWallet
                        ?.days_remaining ==
                      null
                        ? '-'
                        : detailWallet
                            .days_remaining}
                    </strong>
                  </div>
                </section>

                {detailWallet?.hurry_up ? (
                  <div className="rewards-hurry-banner">
                    <strong>
                      Hurry Up
                    </strong>

                    <span>
                      {formatNumber(
                        detailWallet
                          .expiring_soon_points
                      )}{' '}
                      points are close
                      to expiry.
                    </span>
                  </div>
                ) : null}

                <section className="rewards-detail-section">
                  <div className="rewards-detail-title">
                    <h3>
                      Active Reward Lots
                    </h3>

                    <span>
                      {
                        detailActiveLots.length
                      }{' '}
                      active
                    </span>
                  </div>

                  <div className="rewards-lots-grid">
                    {detailActiveLots.length ===
                    0 ? (
                      <div className="rewards-empty-box">
                        No active reward
                        points
                      </div>
                    ) : (
                      detailActiveLots.map(
                        lot => (
                          <article
                            className="rewards-lot-card"
                            key={
                              lot.id
                            }
                          >
                            <div>
                              <span>
                                Remaining
                              </span>

                              <strong>
                                {formatNumber(
                                  lot.points_remaining
                                )}
                              </strong>
                            </div>

                            <dl>
                              <div>
                                <dt>
                                  Source
                                </dt>

                                <dd>
                                  {transactionLabel(
                                    lot.source_type
                                  )}
                                </dd>
                              </div>

                              <div>
                                <dt>
                                  Granted
                                </dt>

                                <dd>
                                  {formatDate(
                                    lot.granted_at
                                  )}
                                </dd>
                              </div>

                              <div>
                                <dt>
                                  Expires
                                </dt>

                                <dd>
                                  {formatDate(
                                    lot.expires_at
                                  )}
                                </dd>
                              </div>

                              <div>
                                <dt>
                                  Days
                                </dt>

                                <dd>
                                  {
                                    lot.days_remaining
                                  }
                                </dd>
                              </div>
                            </dl>
                          </article>
                        )
                      )
                    )}
                  </div>
                </section>

                <section className="rewards-detail-section">
                  <div className="rewards-detail-title">
                    <h3>
                      Transaction History
                    </h3>

                    <span>
                      {history.length}{' '}
                      entries
                    </span>
                  </div>

                  <div className="rewards-history-wrap">
                    <table className="rewards-history-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Type</th>
                          <th>Points</th>
                          <th>Sale ID</th>
                          <th>Expiry</th>
                          <th>Note</th>
                        </tr>
                      </thead>

                      <tbody>
                        {history.length ===
                        0 ? (
                          <tr>
                            <td
                              colSpan="6"
                              className="rewards-table-message"
                            >
                              No reward
                              transactions
                            </td>
                          </tr>
                        ) : (
                          history.map(
                            item => (
                              <tr
                                key={
                                  item.id
                                }
                              >
                                <td>
                                  {formatDateTime(
                                    item.created_at
                                  )}
                                </td>

                                <td>
                                  <span
                                    className={`rewards-transaction-type ${transactionClass(
                                      item.transaction_type
                                    )}`}
                                  >
                                    {transactionLabel(
                                      item.transaction_type
                                    )}
                                  </span>
                                </td>

                                <td>
                                  <strong
                                    className={
                                      number(
                                        item.points
                                      ) >=
                                      0
                                        ? 'rewards-positive'
                                        : 'rewards-negative'
                                    }
                                  >
                                    {number(
                                      item.points
                                    ) >
                                    0
                                      ? '+'
                                      : ''}
                                    {formatNumber(
                                      item.points
                                    )}
                                  </strong>
                                </td>

                                <td className="rewards-sale-id">
                                  {item.sale_id
                                    ? String(
                                        item.sale_id
                                      ).slice(
                                        0,
                                        8
                                      )
                                    : '-'}
                                </td>

                                <td>
                                  {formatDate(
                                    item.expires_at
                                  )}
                                </td>

                                <td>
                                  {item.note ||
                                    '-'}
                                </td>
                              </tr>
                            )
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default RewardPoints