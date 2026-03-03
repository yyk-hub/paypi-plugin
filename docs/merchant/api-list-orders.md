# 📋 list-orders.js - API Documentation

## 🎯 Purpose

Critical endpoint for viewing payment history and analytics.

**Use cases:**
- Admin dashboard: View all orders across all merchants
- Merchant dashboard: View their own orders
- Analytics: Track volumes, credits, revenue
- Support: Debug payment issues
- Reporting: Generate reports

---

## 🔐 Authentication

### Two Auth Types:

**1. Admin Token:**
```bash
Authorization: Bearer ADMIN_TOKEN
```
- Can see ALL merchants' orders
- Can filter by merchant_id
- Gets merchant email & balance info

**2. Merchant API Key:**
```bash
Authorization: Bearer pk_live_abc123xyz789
```
- Can only see THEIR OWN orders
- Cannot see other merchants
- Gets basic order info only

---

## 📡 API Usage

### Admin: View All Orders
```bash
GET /api/merchant/list-orders
Authorization: Bearer ADMIN_TOKEN

Response:
{
  "success": true,
  "orders": [
    {
      "order_id": "ORD-123",
      "merchant_id": "merch_abc",
      "merchant_name": "My Store",
      "merchant_email": "store@example.com",
      "amount": "100π",
      "credits_charged": 2,
      "status": "Paid",
      "created_at": 1234567890
    }
  ],
  "total": 156,
  "totals": {
    "total_orders": 156,
    "paid_orders": 150,
    "total_volume": "15000π",
    "total_credits_used": 300,
    "revenue_collected": "300 credits"
  }
}
```

### Admin: Filter by Merchant
```bash
GET /api/merchant/list-orders?merchant_id=merch_abc
Authorization: Bearer ADMIN_TOKEN

# Returns only orders from merch_abc
```

### Merchant: View Own Orders
```bash
GET /api/merchant/list-orders
Authorization: Bearer pk_live_abc123xyz789

Response:
{
  "success": true,
  "orders": [
    {
      "order_id": "ORD-123",
      "merchant_id": "merch_abc",  // Always their own
      "amount": "100π",
      "credits_charged": 2,
      "status": "Paid"
      // NO merchant_email or balance (privacy)
    }
  ],
  "totals": {
    "total_volume": "5000π",
    "total_credits_used": 100
  }
}
```

---

## 🔍 Query Parameters

### Filtering:

**status** - Filter by order status
```bash
?status=Paid        # Only completed orders
?status=Pending     # Only pending
?status=Cancelled   # Only cancelled
?status=all         # All statuses (default)
```

**merchant_id** - Filter by merchant (admin only)
```bash
?merchant_id=merch_abc  # Only this merchant's orders
```

**from_date / to_date** - Date range (Unix timestamp)
```bash
?from_date=1704067200   # Jan 1, 2024
?to_date=1735689600     # Dec 31, 2024
```

### Pagination:

**limit** - Results per page (default: 50)
```bash
?limit=100   # Show 100 orders
```

**offset** - Skip results (default: 0)
```bash
?offset=50   # Skip first 50, show next 50
```

---

## 📊 Response Fields

### Order Object:
```javascript
{
  "order_id": "ORD-123",
  "merchant_id": "merch_abc",
  "merchant_name": "My Store",
  
  // Customer (if available)
  "user_uid": "user_xyz",
  "pi_username": "@johndoe",
  
  // Payment
  "amount": "100π",
  "credits_charged": 2.0,
  
  // Status
  "status": "Paid",         // Paid, Pending, Cancelled
  "has_refund": false,
  
  // Blockchain
  "pi_payment_id": "xxx",
  "pi_txid": "7a7ed20d...",
  
  // Timestamps
  "created_at": 1234567890,
  "completed_at": 1234567900,
  "refunded_at": null,
  
  // Admin only
  "merchant_email": "store@example.com",
  "merchant_balance": "198 credits"
}
```

### Totals Object:
```javascript
{
  "total_orders": 156,
  "paid_orders": 150,
  "total_volume": "15000π",
  "total_credits_used": 300,
  "refunded_orders": 6,
  "revenue_collected": "300 credits"
}
```

---

## 🎨 Admin Dashboard Usage

```html
<div id="orders-dashboard">
  <h2>Payment Orders</h2>
  
  <!-- Filters -->
  <select id="status-filter">
    <option value="all">All Status</option>
    <option value="Paid">Paid</option>
    <option value="Pending">Pending</option>
    <option value="Cancelled">Cancelled</option>
  </select>
  
  <select id="merchant-filter">
    <option value="">All Merchants</option>
    <!-- Populated from merchants list -->
  </select>
  
  <input type="date" id="from-date">
  <input type="date" id="to-date">
  
  <button onclick="loadOrders()">Filter</button>
  
  <!-- Totals -->
  <div id="totals">
    <div>Total Volume: <span id="total-volume"></span></div>
    <div>Credits Used: <span id="total-credits"></span></div>
    <div>Revenue: <span id="revenue"></span></div>
  </div>
  
  <!-- Orders Table -->
  <table id="orders-table">
    <thead>
      <tr>
        <th>Order ID</th>
        <th>Merchant</th>
        <th>Amount</th>
        <th>Credits</th>
        <th>Status</th>
        <th>Date</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody>
      <!-- Populated via JS -->
    </tbody>
  </table>
  
  <!-- Pagination -->
  <div id="pagination">
    <button onclick="previousPage()">Previous</button>
    <span>Page <span id="current-page"></span></span>
    <button onclick="nextPage()">Next</button>
  </div>
</div>

<script>
let currentPage = 0;
const limit = 50;

async function loadOrders() {
  const status = document.getElementById('status-filter').value;
  const merchantId = document.getElementById('merchant-filter').value;
  const fromDate = document.getElementById('from-date').value;
  const toDate = document.getElementById('to-date').value;
  
  const params = new URLSearchParams({
    status,
    limit,
    offset: currentPage * limit
  });
  
  if (merchantId) params.append('merchant_id', merchantId);
  if (fromDate) params.append('from_date', new Date(fromDate).getTime() / 1000);
  if (toDate) params.append('to_date', new Date(toDate).getTime() / 1000);
  
  const response = await fetch(`/api/merchant/list-orders?${params}`, {
    headers: {
      'Authorization': `Bearer ${ADMIN_TOKEN}`
    }
  });
  
  const data = await response.json();
  
  if (data.success) {
    // Update totals
    document.getElementById('total-volume').textContent = data.totals.total_volume;
    document.getElementById('total-credits').textContent = data.totals.total_credits_used;
    document.getElementById('revenue').textContent = data.totals.revenue_collected;
    
    // Populate table
    const tbody = document.querySelector('#orders-table tbody');
    tbody.innerHTML = data.orders.map(order => `
      <tr>
        <td>${order.order_id}</td>
        <td>${order.merchant_name}</td>
        <td>${order.amount}</td>
        <td>${order.credits_charged}</td>
        <td>${order.status}</td>
        <td>${new Date(order.created_at * 1000).toLocaleString()}</td>
        <td>
          <button onclick="viewOrder('${order.order_id}')">View</button>
          ${order.status === 'Paid' && !order.has_refund ? 
            `<button onclick="refundOrder('${order.order_id}')">Refund</button>` : ''}
        </td>
      </tr>
    `).join('');
    
    // Update pagination
    document.getElementById('current-page').textContent = currentPage + 1;
  }
}

function nextPage() {
  currentPage++;
  loadOrders();
}

function previousPage() {
  if (currentPage > 0) {
    currentPage--;
    loadOrders();
  }
}

// Load on page load
loadOrders();
</script>
```

---

## 🛍️ Merchant Dashboard Usage

```html
<div id="my-orders">
  <h2>My Payment History</h2>
  
  <!-- Simple filters -->
  <select id="status-filter">
    <option value="all">All</option>
    <option value="Paid">Completed</option>
    <option value="Pending">Pending</option>
  </select>
  
  <button onclick="loadMyOrders()">Refresh</button>
  
  <!-- Stats -->
  <div id="stats">
    <div>Total Processed: <span id="total"></span></div>
    <div>Credits Used: <span id="credits"></span></div>
  </div>
  
  <!-- Orders -->
  <div id="orders-list">
    <!-- Populated via JS -->
  </div>
</div>

<script>
async function loadMyOrders() {
  const status = document.getElementById('status-filter').value;
  
  const response = await fetch(`/api/merchant/list-orders?status=${status}`, {
    headers: {
      'Authorization': `Bearer ${MERCHANT_API_KEY}`
    }
  });
  
  const data = await response.json();
  
  if (data.success) {
    document.getElementById('total').textContent = data.totals.total_volume;
    document.getElementById('credits').textContent = data.totals.total_credits_used;
    
    // Display orders
    const ordersList = document.getElementById('orders-list');
    ordersList.innerHTML = data.orders.map(order => `
      <div class="order-card">
        <h4>${order.order_id}</h4>
        <p>Amount: ${order.amount}</p>
        <p>Credits: ${order.credits_charged}</p>
        <p>Status: ${order.status}</p>
        <p>Date: ${new Date(order.created_at * 1000).toLocaleDateString()}</p>
      </div>
    `).join('');
  }
}

loadMyOrders();
</script>
```

---

## 📊 Analytics Examples

### Daily Revenue Report
```javascript
const today = new Date();
today.setHours(0, 0, 0, 0);
const todayTimestamp = Math.floor(today.getTime() / 1000);

const response = await fetch(`/api/merchant/list-orders?from_date=${todayTimestamp}&status=Paid`, {
  headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` }
});

const data = await response.json();
console.log('Today\'s revenue:', data.totals.revenue_collected);
```

### Top Merchants
```javascript
// Get all merchants
const merchants = await getAllMerchants();

// Get orders for each
const merchantStats = await Promise.all(
  merchants.map(async m => {
    const orders = await fetch(`/api/merchant/list-orders?merchant_id=${m.merchant_id}`, {
      headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` }
    });
    const data = await orders.json();
    return {
      name: m.business_name,
      volume: data.totals.total_volume,
      credits: data.totals.total_credits_used
    };
  })
);

// Sort by volume
merchantStats.sort((a, b) => b.credits - a.credits);
console.log('Top merchants:', merchantStats.slice(0, 10));
```

---

## ✅ Why This File is Critical

Without `list-orders.js`:
- ❌ No payment history view
- ❌ No analytics dashboard
- ❌ Can't track revenue
- ❌ Can't debug payment issues
- ❌ No merchant reporting
- ❌ Incomplete admin panel

With `list-orders.js`:
- ✅ Complete payment history
- ✅ Real-time analytics
- ✅ Revenue tracking
- ✅ Payment debugging
- ✅ Merchant reports
- ✅ Full admin dashboard

---

## 🎯 Summary

**Endpoint:** `GET /api/merchant/list-orders`

**Auth:**
- Admin: See all merchants
- Merchant: See own orders only

**Features:**
- Filter by status, merchant, date
- Pagination support
- Aggregate totals
- Revenue analytics
- Secure (validates API keys)

**Status:** ✅ ESSENTIAL - Must have for admin panel!