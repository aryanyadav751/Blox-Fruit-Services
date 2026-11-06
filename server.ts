import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { dbRepository, ensureNeonServicesSeeded } from './src/db/index.ts';
import { ensureNeonSchema, isNeonConfigured, getNeonDb } from './src/db/neon.ts';
import { 
  toHundredths, 
  calculateDepositAndRemaining, 
  generatePublicToken 
} from './src/lib/calculator.ts';
import { 
  verifyAdminPassword, 
  createStaffSessionToken, 
  verifyStaffSessionToken 
} from './src/lib/auth.ts';
import { 
  researchSingleItem, 
  researchCatalogItems, 
  initValueResearchScheduler,
  getMarketTrends,
  executeScheduledResearchCycle,
  discoverNewItemsAndVariants
} from './src/server/valueResearcher.ts';
import { migrateNeonToFirestore } from './src/db/migrate-to-firestore.ts';
import { verifyFirebaseIdToken, ADMIN_EMAIL } from './src/server/firebaseAdmin.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', true);

function resolvePort(): number {
  const portArgIndex = process.argv.findIndex((arg) => arg === '--port' || arg === '-p');
  if (portArgIndex !== -1 && process.argv[portArgIndex + 1]) {
    const parsed = parseInt(process.argv[portArgIndex + 1], 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  if (process.env.PORT) {
    const parsed = parseInt(process.env.PORT, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return 3000;
}

const port = resolvePort();

app.use(express.json());

// In-memory rate limiting for order submissions and admin login
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(ip: string, maxRequests = 15, windowMs = 60000): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxRequests) {
    return false;
  }
  entry.count++;
  return true;
}

// Clean up stale rate limits periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of rateLimitMap.entries()) {
    if (now > val.resetAt) rateLimitMap.delete(key);
  }
}, 300000);

// --- PUBLIC API ROUTES ---

// 1. Get published services catalog
app.get('/api/services', async (_req, res) => {
  try {
    const published = await dbRepository.getServices({ onlyPublished: true });
    res.json({ success: true, services: published });
  } catch (err: any) {
    console.error('Error fetching services:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve catalog' });
  }
});

// 2. Get single published service by slug or ID
app.get('/api/services/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    let service = await dbRepository.getServiceBySlug(identifier);
    if (!service) {
      service = await dbRepository.getServiceById(identifier);
    }

    if (!service || !service.isPublished) {
      return res.status(404).json({ success: false, error: 'Service not found or unpublished' });
    }

    res.json({ success: true, service });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Error fetching service' });
  }
});

// 3. Submit Customer Order
app.post('/api/orders', async (req, res) => {
  const ip = req.headers['x-forwarded-for']?.toString() || req.socket.remoteAddress || 'unknown';
  if (!checkRateLimit(`order_${ip}`, 10, 60000)) {
    return res.status(429).json({ 
      success: false, 
      error: 'Too many order requests. Please wait a minute before submitting again.' 
    });
  }

  try {
    const { 
      serviceId, 
      robloxUsername, 
      timezone, 
      availability, 
      paymentType, 
      items, 
      customerNote,
      consentPublicProofs
    } = req.body;

    if (!serviceId || !robloxUsername || !timezone || !availability) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required order fields (serviceId, robloxUsername, timezone, availability)' 
      });
    }

    const service = await dbRepository.getServiceById(serviceId);
    if (!service) {
      return res.status(404).json({ success: false, error: 'Service not found in catalog' });
    }
    if (!service.isPublished) {
      return res.status(400).json({ 
        success: false, 
        error: 'This service is currently unavailable for new bookings.' 
      });
    }

    // Sanitize username (alphanumeric + underscore only, standard Roblox username rule)
    const cleanUsername = String(robloxUsername).trim();
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(cleanUsername)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid Roblox username format. Usernames contain 3-20 letters, numbers, or underscores.' 
      });
    }

    // Validate offered items
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'At least one fruit or gamepass must be offered for payment.' 
      });
    }

    // Fetch current catalog to ensure customer cannot tamper with or manipulate catalogue prices
    const catalogServices = await dbRepository.getServices();
    const catalogMap = new Map<string, number>();
    for (const cat of catalogServices) {
      catalogMap.set(cat.name.toLowerCase().trim(), cat.priceHundredths);
    }

    const orderItemsData = items.map((item: any) => {
      const name = String(item.itemName || '').trim();
      const qty = Math.max(1, parseInt(item.quantity || 1, 10));
      const cleanLower = name.toLowerCase();

      // If item is found in the official database catalogue, strictly lock its value
      // Customers are NEVER allowed to override or reduce official catalogue trade values
      let valHundredths: number;
      if (catalogMap.has(cleanLower)) {
        valHundredths = catalogMap.get(cleanLower)!;
      } else {
        const valM = parseFloat(item.proposedValueM || 0);
        valHundredths = toHundredths(isNaN(valM) ? 0 : valM);
      }

      return {
        itemName: name || 'Unnamed Item',
        quantity: qty,
        proposedValueHundredths: Math.max(0, valHundredths),
        agreedValueHundredths: null,
      };
    });

    const totalHundredths = service.priceHundredths;
    const { depositHundredths, remainingHundredths } = calculateDepositAndRemaining(totalHundredths);

    const publicToken = generatePublicToken();
    const orderCode = await dbRepository.getNextOrderCode();

    const { order } = await dbRepository.createOrder(
      {
        publicToken,
        orderCode,
        serviceId: service.id,
        robloxUsername: cleanUsername,
        timezone: String(timezone).trim(),
        availability: String(availability).trim(),
        paymentType: ['fruits', 'gamepass', 'combination'].includes(paymentType) ? paymentType : 'combination',
        status: 'pending_review',
        totalPriceHundredths: totalHundredths,
        depositHundredths,
        remainingHundredths,
        customerNote: customerNote ? String(customerNote).trim().slice(0, 500) : null,
        staffNotes: null,
        consentPublicProofs: Boolean(consentPublicProofs),
      },
      orderItemsData
    );

    return res.status(201).json({
      success: true,
      orderCode: order.orderCode,
      publicToken: order.publicToken,
      orderId: order.id,
      serviceName: service.name,
      totalPriceM: (order.totalPriceHundredths / 100).toFixed(2),
      depositM: (order.depositHundredths / 100).toFixed(2),
      remainingM: (order.remainingHundredths / 100).toFixed(2),
    });
  } catch (err: any) {
    console.error('Error creating order:', err);
    return res.status(500).json({ success: false, error: 'Internal server error while processing order' });
  }
});

// 4. Public Order Status by unguessable public_token
app.get('/api/orders/track/:token', async (req, res) => {
  try {
    const { token } = req.params;
    if (!token || token.length < 16) {
      return res.status(400).json({ success: false, error: 'Invalid tracking token' });
    }

    const order = await dbRepository.getOrderByPublicToken(token);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found. Please check your tracking link.' });
    }

    const service = await dbRepository.getServiceById(order.serviceId);
    const items = await dbRepository.getOrderItems(order.id);
    const auditLogs = await dbRepository.getOrderAuditLogs(order.id);
    const payments = await dbRepository.getOrderPayments(order.id);

    // Filter audit logs for customer view (strip sensitive internal staff notes)
    const publicTimeline = auditLogs.map(log => ({
      action: log.action,
      note: log.note,
      createdAt: log.createdAt,
      actor: log.actor === 'staff' ? 'Staff Member' : 'System',
    }));

    // Customer safe representation (no passwords, no raw staff-only fields)
    res.json({
      success: true,
      order: {
        orderCode: order.orderCode,
        publicToken: order.publicToken,
        serviceName: service ? service.name : 'Blox Fruit Service',
        serviceCategory: service ? service.category : 'General',
        robloxUsername: order.robloxUsername,
        timezone: order.timezone,
        availability: order.availability,
        paymentType: order.paymentType,
        status: order.status,
        totalPriceM: (order.totalPriceHundredths / 100).toFixed(2),
        depositM: (order.depositHundredths / 100).toFixed(2),
        remainingM: (order.remainingHundredths / 100).toFixed(2),
        customerNote: order.customerNote,
        consentPublicProofs: order.consentPublicProofs,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        items: items.map(i => ({
          itemName: i.itemName,
          quantity: i.quantity,
          proposedValueM: (i.proposedValueHundredths / 100).toFixed(2),
          agreedValueM: i.agreedValueHundredths !== null && i.agreedValueHundredths !== undefined
            ? (i.agreedValueHundredths / 100).toFixed(2)
            : null,
          verified: i.verified,
        })),
        payments: payments.map(p => ({
          kind: p.kind,
          amountM: (p.amountHundredths / 100).toFixed(2),
          recordedAt: p.recordedAt,
        })),
        timeline: publicTimeline,
      }
    });
  } catch (err: any) {
    console.error('Error tracking order:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve order status' });
  }
});

// 5. Submit Customer Support Enquiry
app.post('/api/support/enquiries', async (req, res) => {
  const ip = req.headers['x-forwarded-for']?.toString() || req.socket.remoteAddress || 'unknown';
  if (!checkRateLimit(`enquiry_${ip}`, 8, 60000)) {
    return res.status(429).json({ 
      success: false, 
      error: 'Too many requests. Please wait a minute before submitting another enquiry.' 
    });
  }

  try {
    const { robloxUsername, customerName, discordTag, orderCodeOrId, subject, message } = req.body;
    if (!robloxUsername || !subject || !message) {
      return res.status(400).json({ 
        success: false, 
        error: 'Roblox username, subject, and message are required.' 
      });
    }

    const cleanUsername = String(robloxUsername).trim();
    const cleanSubject = String(subject).trim().slice(0, 150);
    const cleanMessage = String(message).trim().slice(0, 2000);

    const enquiry = await dbRepository.createEnquiry({
      source: 'website',
      customerName: customerName ? String(customerName).trim().slice(0, 100) : null,
      robloxUsername: cleanUsername,
      discordTag: discordTag ? String(discordTag).trim().slice(0, 100) : null,
      orderCodeOrId: orderCodeOrId ? String(orderCodeOrId).trim().toUpperCase() : null,
      subject: cleanSubject,
      message: cleanMessage,
      status: 'pending',
      staffNotes: null,
    });

    res.status(201).json({ 
      success: true, 
      enquiryId: enquiry.id, 
      message: 'Support enquiry submitted. Our staff will review it shortly!' 
    });
  } catch (err: any) {
    console.error('Submit enquiry error:', err);
    res.status(500).json({ success: false, error: 'Failed to submit enquiry' });
  }
});

// 6. Public Proofs Showcase (Strictly Customer Consented + Staff Approved)
app.get('/api/proofs', async (_req, res) => {
  try {
    const proofs = await dbRepository.getPublicProofs();
    res.json({ success: true, proofs });
  } catch (err: any) {
    console.error('Error fetching proofs:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch public proofs' });
  }
});

// 7. Ongoing Services (Active Carries Queue - Privacy Masked unless consented)
app.get('/api/ongoing', async (_req, res) => {
  try {
    const activeCarries = await dbRepository.getOngoingCarries();
    res.json({ success: true, activeCarries });
  } catch (err: any) {
    console.error('Error fetching ongoing carries:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch ongoing carries' });
  }
});

// 8. Notice: Website media uploads are disabled. Proofs are coordinated via Discord.
app.post('/api/storage/presigned-upload', (_req, res) => {
  res.status(400).json({
    success: false,
    error: 'Website media uploads are disabled. All service completion proofs and screenshots are coordinated and shared manually through Discord.'
  });
});

// 9. Notice: Website media download presigning is disabled. Proofs are shared via Discord.
app.get('/api/storage/presigned-download', (_req, res) => {
  res.status(400).json({
    success: false,
    error: 'Website media storage is disabled. All service proofs are shared manually through Discord.'
  });
});

// --- STAFF ADMIN AUTHENTICATION & API ROUTES ---

// Helper to extract session token from Authorization header or cookie
function extractStaffToken(req: express.Request): string | null {
  // 1. Authorization header: Bearer <token>
  const authHeader = req.get('authorization') || req.headers.authorization;
  if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const raw = authHeader.substring(7).trim();
    if (raw && raw !== 'null' && raw !== 'undefined') {
      return raw;
    }
  }

  // 2. Cookie header: bfs_staff_session=<token>
  const cookieHeader = req.headers.cookie;
  if (cookieHeader && typeof cookieHeader === 'string') {
    const match = cookieHeader.match(/(?:^|;\s*)bfs_staff_session=([^;]+)/);
    if (match) {
      let raw = match[1].trim();
      try {
        raw = decodeURIComponent(raw);
      } catch {}
      if (raw.startsWith('"') && raw.endsWith('"')) {
        raw = raw.slice(1, -1).trim();
      }
      if (raw && raw !== 'null' && raw !== 'undefined') {
        return raw;
      }
    }
  }

  return null;
}

// Middleware: Require valid staff session
async function requireStaffAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const token = extractStaffToken(req);
  if (!token) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Admin Only. Staff session required.' });
  }

  // 1. Check if token is a Firebase ID Token (JWT format: 3 segments separated by dots)
  if (token.split('.').length === 3) {
    const verification = await verifyFirebaseIdToken(token);
    if (!verification) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Invalid Firebase authentication token.' });
    }
    if (!verification.isAdmin) {
      return res.status(403).json({ success: false, error: 'Forbidden: Admin custom claim required for administrative access.' });
    }
    (req as any).staffSession = {
      staffId: verification.email || verification.uid,
      role: 'staff',
      isAdmin: true,
      uid: verification.uid,
    };
    return next();
  }

  // 2. Check if token is a signed staff HMAC session token
  const session = verifyStaffSessionToken(token);
  if (!session || session.role !== 'staff') {
    return res.status(401).json({ success: false, error: 'Unauthorized: Admin Only. Session expired or invalid. Please log in again.' });
  }

  (req as any).staffSession = { ...session, isAdmin: true };
  next();
}

// 1. Staff Login
app.post('/api/admin/login', (req, res) => {
  const ip = req.headers['x-forwarded-for']?.toString() || req.socket.remoteAddress || 'unknown';
  if (!checkRateLimit(`login_${ip}`, 5, 60000)) {
    return res.status(429).json({ 
      success: false, 
      error: 'Too many failed login attempts. Please wait 60 seconds.' 
    });
  }

  const { password } = req.body;
  if (!password || !verifyAdminPassword(password)) {
    return res.status(401).json({ success: false, error: 'Invalid staff admin password' });
  }

  const token = createStaffSessionToken('staff_operator');
  const proto = (req.headers['x-forwarded-proto'] || req.protocol || '').toString().toLowerCase();
  const host = (req.headers['host'] || '').toLowerCase();
  const isHttps = req.secure || proto.includes('https') || host.includes('run.app') || process.env.NODE_ENV === 'production' || !!process.env.VERCEL;

  // Include Partitioned attribute for CHIPS (Chrome / iframe partitioned cookies)
  const cookieOpts = isHttps
    ? `bfs_staff_session=${token}; Path=/; HttpOnly; SameSite=None; Secure; Partitioned; Max-Age=86400`
    : `bfs_staff_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`;

  res.setHeader('Set-Cookie', cookieOpts);

  return res.json({
    success: true,
    token,
    role: 'staff',
    message: 'Staff authentication successful',
  });
});

// 2. Staff Logout
app.post('/api/admin/logout', (req, res) => {
  const proto = (req.headers['x-forwarded-proto'] || req.protocol || '').toString().toLowerCase();
  const host = (req.headers['host'] || '').toLowerCase();
  const isHttps = req.secure || proto.includes('https') || host.includes('run.app') || process.env.NODE_ENV === 'production' || !!process.env.VERCEL;

  const cookieOpts = isHttps
    ? 'bfs_staff_session=; Path=/; HttpOnly; SameSite=None; Secure; Partitioned; Max-Age=0'
    : 'bfs_staff_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0';

  res.setHeader('Set-Cookie', cookieOpts);
  res.json({ success: true, message: 'Logged out successfully' });
});

// 3. Verify Current Session
app.get('/api/admin/me', requireStaffAuth, (req, res) => {
  const session = (req as any).staffSession;
  res.json({ success: true, staffId: session.staffId, role: session.role });
});

// 4. List All Orders for Staff Dashboard
app.get('/api/admin/orders', requireStaffAuth, async (req, res) => {
  try {
    const status = req.query.status?.toString();
    const search = req.query.search?.toString();

    const orders = await dbRepository.listOrders({ status, search });
    
    // Enrich orders with service name and payment totals
    const enriched = await Promise.all(
      orders.map(async (o) => {
        const service = await dbRepository.getServiceById(o.serviceId);
        const payments = await dbRepository.getOrderPayments(o.id);
        const totalPaidHundredths = payments.reduce((sum, p) => sum + p.amountHundredths, 0);

        return {
          id: o.id,
          orderCode: o.orderCode,
          publicToken: o.publicToken,
          serviceId: o.serviceId,
          serviceName: service ? service.name : 'Unknown Service',
          serviceCategory: service ? service.category : 'General',
          robloxUsername: o.robloxUsername,
          timezone: o.timezone,
          availability: o.availability,
          paymentType: o.paymentType,
          status: o.status,
          totalPriceM: (o.totalPriceHundredths / 100).toFixed(2),
          depositM: (o.depositHundredths / 100).toFixed(2),
          remainingM: (o.remainingHundredths / 100).toFixed(2),
          totalPaidM: (totalPaidHundredths / 100).toFixed(2),
          createdAt: o.createdAt,
          updatedAt: o.updatedAt,
        };
      })
    );

    res.json({ success: true, orders: enriched });
  } catch (err: any) {
    console.error('Admin list orders error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch admin orders' });
  }
});

// 5. Get Single Order Detail with Audit Logs and Payments
app.get('/api/admin/orders/:id', requireStaffAuth, async (req, res) => {
  try {
    const { id } = req.params;
    let order = await dbRepository.getOrderById(id);
    if (!order) {
      order = await dbRepository.getOrderByCode(id);
    }

    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    const service = await dbRepository.getServiceById(order.serviceId);
    const items = await dbRepository.getOrderItems(order.id);
    const auditLogs = await dbRepository.getOrderAuditLogs(order.id);
    const payments = await dbRepository.getOrderPayments(order.id);

    res.json({
      success: true,
      order: {
        id: order.id,
        orderCode: order.orderCode,
        publicToken: order.publicToken,
        serviceId: order.serviceId,
        serviceName: service ? service.name : 'Unknown Service',
        serviceCategory: service ? service.category : 'General',
        servicePriceM: service ? service.priceM : '0.00',
        robloxUsername: order.robloxUsername,
        timezone: order.timezone,
        availability: order.availability,
        paymentType: order.paymentType,
        status: order.status,
        totalPriceM: (order.totalPriceHundredths / 100).toFixed(2),
        depositM: (order.depositHundredths / 100).toFixed(2),
        remainingM: (order.remainingHundredths / 100).toFixed(2),
        customerNote: order.customerNote,
        staffNotes: order.staffNotes,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        items: items.map(i => ({
          id: i.id,
          itemName: i.itemName,
          quantity: i.quantity,
          proposedValueM: (i.proposedValueHundredths / 100).toFixed(2),
          agreedValueM: i.agreedValueHundredths !== null && i.agreedValueHundredths !== undefined
            ? (i.agreedValueHundredths / 100).toFixed(2)
            : null,
          verified: i.verified,
        })),
        payments: payments.map(p => ({
          id: p.id,
          kind: p.kind,
          amountM: (p.amountHundredths / 100).toFixed(2),
          itemsJson: p.itemsJson,
          recordedBy: p.recordedBy,
          recordedAt: p.recordedAt,
        })),
        auditLogs,
      }
    });
  } catch (err: any) {
    console.error('Admin get order detail error:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve order details' });
  }
});

// 6. Update Order Status (Staff Action)
app.post('/api/admin/orders/:id/status', requireStaffAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, note } = req.body;

    const validStatuses = [
      'pending_review',
      'accepted',
      'more_info_needed',
      'deposit_received',
      'in_progress',
      'completed',
      'fully_paid',
      'rejected',
      'cancelled'
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid order status specified' });
    }

    const order = await dbRepository.getOrderById(id);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    const updated = await dbRepository.updateOrderStatus(id, status, 'staff', note);
    res.json({ success: true, order: updated });
  } catch (err: any) {
    console.error('Update status error:', err);
    res.status(500).json({ success: false, error: 'Failed to update order status' });
  }
});

// 7. Staff Item Valuation & Verification Action
app.post('/api/admin/orders/:id/items/:itemId', requireStaffAuth, async (req, res) => {
  try {
    const { id, itemId } = req.params;
    const { agreedValueM, verified } = req.body;

    const valHundredths = agreedValueM !== undefined && agreedValueM !== null
      ? toHundredths(agreedValueM)
      : null;

    const updatedItem = await dbRepository.updateOrderItem(itemId, {
      agreedValueHundredths: valHundredths,
      verified: Boolean(verified),
    });

    if (!updatedItem) {
      return res.status(404).json({ success: false, error: 'Order item not found' });
    }

    await dbRepository.addAuditLog(
      id,
      'staff',
      'ITEM_VALUATION_CONFIRMED',
      `Staff verified "${updatedItem.itemName}". Agreed value: ${(updatedItem.agreedValueHundredths || 0) / 100}M. Verified: ${updatedItem.verified}`
    );

    res.json({ success: true, item: updatedItem });
  } catch (err: any) {
    console.error('Item update error:', err);
    res.status(500).json({ success: false, error: 'Failed to update item valuation' });
  }
});

// 8. Record In-Game Trade Payment (Deposit or Remaining)
app.post('/api/admin/orders/:id/payments', requireStaffAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { kind, amountM, itemsJson, staffName } = req.body;

    if (!['deposit', 'remaining'].includes(kind)) {
      return res.status(400).json({ success: false, error: 'Payment kind must be "deposit" or "remaining"' });
    }

    const order = await dbRepository.getOrderById(id);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    const amountHundredths = toHundredths(amountM);
    if (amountHundredths <= 0) {
      return res.status(400).json({ success: false, error: 'Payment amount must be greater than 0M' });
    }

    const recordedBy = staffName ? String(staffName).trim() : 'Staff Member';
    const payment = await dbRepository.recordPayment(
      id,
      kind,
      amountHundredths,
      itemsJson || '[]',
      recordedBy
    );

    // Update order status: deposit -> deposit_received, remaining -> fully_paid
    if (kind === 'deposit') {
      await dbRepository.updateOrderStatus(id, 'deposit_received', 'staff', `50% deposit (${amountM}M) received in-game by ${recordedBy}`);
    } else if (kind === 'remaining') {
      await dbRepository.updateOrderStatus(id, 'fully_paid', 'staff', `Remaining balance (${amountM}M) received in-game by ${recordedBy}`);
    }

    res.json({ success: true, payment, updatedStatus: kind === 'deposit' ? 'deposit_received' : 'fully_paid' });
  } catch (err: any) {
    console.error('Record payment error:', err);
    res.status(500).json({ success: false, error: 'Failed to record payment' });
  }
});

// 9. Update Internal Staff Notes
app.post('/api/admin/orders/:id/notes', requireStaffAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { staffNotes } = req.body;

    const updated = await dbRepository.updateOrderStaffNotes(id, String(staffNotes || ''));
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    await dbRepository.addAuditLog(id, 'staff', 'STAFF_NOTES_UPDATED', 'Staff updated internal notes');
    res.json({ success: true, order: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to update staff notes' });
  }
});

// 10. Admin Catalog API (CRUD)
app.get('/api/admin/catalog', requireStaffAuth, async (_req, res) => {
  try {
    const all = await dbRepository.getServices();
    res.json({ success: true, services: all });
  } catch (err: any) {
    console.error('Failed to fetch admin catalogue error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch admin catalogue' });
  }
});

app.post('/api/admin/catalog', requireStaffAuth, async (req, res) => {
  try {
    const { category, name, slug, description, priceM, prerequisites, exclusions, isPublished, needsConfirmation } = req.body;
    
    if (!category || typeof category !== 'string' || !category.trim()) {
      return res.status(400).json({ success: false, error: 'Category is required and must be a valid string.' });
    }
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Name is required and must be a valid string.' });
    }
    const parsedPrice = parseFloat(priceM);
    if (priceM === undefined || priceM === null || isNaN(parsedPrice) || parsedPrice < 0) {
      return res.status(400).json({ success: false, error: 'Valid non-negative trade price (priceM) is required.' });
    }

    const cleanCategory = String(category).trim().slice(0, 50);
    const cleanName = String(name).trim().slice(0, 100);
    const cleanDescription = String(description || '').trim().slice(0, 2000);
    const priceHundredths = toHundredths(parsedPrice);
    const baseSlug = (slug && typeof slug === 'string' && slug.trim())
      ? slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      : cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const generatedSlug = baseSlug || `item-${Date.now()}`;

    const newService = await dbRepository.createService({
      category: cleanCategory,
      name: cleanName,
      slug: generatedSlug,
      description: cleanDescription,
      priceHundredths,
      priceM: (priceHundredths / 100).toFixed(2),
      prerequisites: prerequisites ? String(prerequisites).trim().slice(0, 500) : null,
      exclusions: exclusions ? String(exclusions).trim().slice(0, 500) : null,
      isPublished: Boolean(isPublished),
      needsConfirmation: Boolean(needsConfirmation),
    });

    res.status(201).json({ success: true, service: newService });
  } catch (err: any) {
    console.error('Create service error:', err);
    res.status(500).json({ success: false, error: 'Failed to create service in database' });
  }
});

app.put('/api/admin/catalog/:id', requireStaffAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { category, name, description, priceM, prerequisites, exclusions, isPublished, needsConfirmation } = req.body;

    const existing = await dbRepository.getServiceById(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Catalogue item not found' });
    }

    const updates: any = {};
    if (category !== undefined) {
      if (typeof category !== 'string' || !category.trim()) {
        return res.status(400).json({ success: false, error: 'Category cannot be empty.' });
      }
      updates.category = String(category).trim().slice(0, 50);
    }
    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ success: false, error: 'Name cannot be empty.' });
      }
      updates.name = String(name).trim().slice(0, 100);
    }
    if (description !== undefined) {
      updates.description = String(description).trim().slice(0, 2000);
    }
    if (priceM !== undefined) {
      const parsed = parseFloat(priceM);
      if (isNaN(parsed) || parsed < 0) {
        return res.status(400).json({ success: false, error: 'Trade price (priceM) must be a non-negative number.' });
      }
      const h = toHundredths(parsed);
      updates.priceHundredths = h;
      updates.priceM = (h / 100).toFixed(2);
    }
    if (prerequisites !== undefined) updates.prerequisites = prerequisites ? String(prerequisites).trim().slice(0, 500) : null;
    if (exclusions !== undefined) updates.exclusions = exclusions ? String(exclusions).trim().slice(0, 500) : null;
    if (isPublished !== undefined) updates.isPublished = Boolean(isPublished);
    if (needsConfirmation !== undefined) updates.needsConfirmation = Boolean(needsConfirmation);

    const updated = await dbRepository.updateService(id, updates);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Service not found' });
    }

    res.json({ success: true, service: updated });
  } catch (err: any) {
    console.error('Update service error:', err);
    res.status(500).json({ success: false, error: 'Failed to update service' });
  }
});

app.delete('/api/admin/catalog/:id', requireStaffAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const ok = await dbRepository.deleteService(id);
    if (!ok) {
      return res.status(404).json({ success: false, error: 'Catalogue item not found' });
    }
    res.json({ success: true, message: 'Item deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to delete service' });
  }
});

// 11. Staff Support Inbox: List & Search Enquiries
app.get('/api/admin/enquiries', requireStaffAuth, async (req, res) => {
  try {
    const status = req.query.status?.toString();
    const search = req.query.search?.toString();
    const enquiries = await dbRepository.listEnquiries({ status, search });
    res.json({ success: true, enquiries });
  } catch (err: any) {
    console.error('List enquiries error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch enquiries' });
  }
});

// 12. Staff Manual Enquiry Recording (Discord DMs / In-Game tickets)
app.post('/api/admin/enquiries', requireStaffAuth, async (req, res) => {
  try {
    const { source, robloxUsername, customerName, discordTag, orderCodeOrId, subject, message, status, staffNotes } = req.body;
    if (!robloxUsername || !subject || !message) {
      return res.status(400).json({ 
        success: false, 
        error: 'Roblox username, subject, and message are required' 
      });
    }

    const cleanUsername = String(robloxUsername).trim();
    const enquiry = await dbRepository.createEnquiry({
      source: ['website', 'discord', 'direct'].includes(source) ? source : 'discord',
      customerName: customerName ? String(customerName).trim().slice(0, 100) : null,
      robloxUsername: cleanUsername,
      discordTag: discordTag ? String(discordTag).trim().slice(0, 100) : null,
      orderCodeOrId: orderCodeOrId ? String(orderCodeOrId).trim().toUpperCase() : null,
      subject: String(subject).trim().slice(0, 150),
      message: String(message).trim().slice(0, 2000),
      status: ['pending', 'in_progress', 'resolved'].includes(status) ? status : 'pending',
      staffNotes: staffNotes ? String(staffNotes).trim() : null,
    });

    res.status(201).json({ success: true, enquiry });
  } catch (err: any) {
    console.error('Record manual enquiry error:', err);
    res.status(500).json({ success: false, error: 'Failed to record manual enquiry' });
  }
});

// 13. Update Enquiry Status & Staff Notes
app.patch('/api/admin/enquiries/:id', requireStaffAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, staffNotes } = req.body;

    if (!['pending', 'in_progress', 'resolved'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    const updated = await dbRepository.updateEnquiryStatus(id, status, staffNotes);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Enquiry not found' });
    }

    res.json({ success: true, enquiry: updated });
  } catch (err: any) {
    console.error('Update enquiry error:', err);
    res.status(500).json({ success: false, error: 'Failed to update enquiry' });
  }
});

// 14. Record Service Evidence / Discord Proof Notes
app.post('/api/admin/orders/:id/evidence', requireStaffAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { evidenceType, mediaUrl, notes, customerConsentPublic, staffApprovedPublic, isOngoing, isCompleted } = req.body;

    const order = await dbRepository.getOrderById(id);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    if (!evidenceType || !mediaUrl) {
      return res.status(400).json({ success: false, error: 'Evidence type and media URL/link are required' });
    }

    const session = (req as any).staffSession;
    const ev = await dbRepository.createEvidence({
      orderId: order.id,
      serviceId: order.serviceId,
      evidenceType: ['screenshot', 'video_link', 'screen_share_session'].includes(evidenceType) ? evidenceType : 'screenshot',
      mediaUrl: String(mediaUrl).trim(),
      notes: notes ? String(notes).trim() : null,
      customerConsentPublic: Boolean(customerConsentPublic),
      staffApprovedPublic: Boolean(staffApprovedPublic),
      isOngoing: Boolean(isOngoing),
      isCompleted: isCompleted !== undefined ? Boolean(isCompleted) : true,
      reviewedAt: staffApprovedPublic ? new Date().toISOString() : null,
      reviewedBy: staffApprovedPublic ? session.staffId : null,
    });

    await dbRepository.addAuditLog(
      id,
      'staff',
      'EVIDENCE_RECORDED',
      `Evidence (${ev.evidenceType}) recorded by ${session.staffId}. Public approval: ${ev.staffApprovedPublic}`
    );

    res.status(201).json({ success: true, evidence: ev });
  } catch (err: any) {
    console.error('Attach evidence error:', err);
    res.status(500).json({ success: false, error: 'Failed to attach evidence' });
  }
});

// 15. List Evidence for an Order
app.get('/api/admin/orders/:id/evidence', requireStaffAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const evidence = await dbRepository.getEvidenceByOrderId(id);
    res.json({ success: true, evidence });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to retrieve evidence' });
  }
});

// 16. Toggle Evidence Public Approval
app.post('/api/admin/evidence/:id/approval', requireStaffAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { staffApprovedPublic } = req.body;
    const session = (req as any).staffSession;

    const updated = await dbRepository.updateEvidenceApproval(id, Boolean(staffApprovedPublic), session.staffId);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Evidence not found' });
    }

    res.json({ success: true, evidence: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to update approval' });
  }
});

// ============================================================================
// BLOX FRUITS VALUE RESEARCH SYSTEM ENDPOINTS
// ============================================================================

// 17. Public Market Verification Status
app.get('/api/public/market-status', async (_req, res) => {
  try {
    const history = await dbRepository.listValueHistory();
    const research = await dbRepository.listResearchResults();
    const approvedItems = research.filter(r => r.status === 'approved');
    const latestUpdate = history[0]?.timestamp || approvedItems[0]?.approvedAt || null;

    res.json({
      success: true,
      lastVerifiedAt: latestUpdate,
      totalApprovedUpdates: history.length,
      recentApprovalsCount: approvedItems.length,
      note: 'All customer catalog and trade values are verified against authoritative market references and manually approved by senior staff.',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to retrieve market status' });
  }
});

// 18. Public Market Trends (Top 5 Most Volatile Fruits & Trade Values via Gemini Research)
app.get('/api/public/market-trends', async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const { trends, lastUpdated, isLiveGrounding } = await getMarketTrends(forceRefresh);

    res.json({
      success: true,
      trends,
      lastUpdated,
      isLiveGrounding,
      source: isLiveGrounding ? 'Gemini 3.8 Flash Google Search Grounding' : 'Verified Community Market Benchmarks',
    });
  } catch (err: any) {
    console.error('Market trends endpoint error:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve market trends' });
  }
});

// 19. List Researched Values (Admin Only)
app.get('/api/admin/research', requireStaffAuth, async (req, res) => {
  try {
    const status = req.query.status?.toString();
    const category = req.query.category?.toString();
    const search = req.query.search?.toString();

    const results = await dbRepository.listResearchResults({ status, category, search });
    res.json({ success: true, results });
  } catch (err: any) {
    console.error('List research results error:', err);
    res.status(500).json({ success: false, error: 'Failed to list research results' });
  }
});

// 19. Trigger Research for a Single Item (Admin Only)
app.post('/api/admin/research/single', requireStaffAuth, async (req, res) => {
  try {
    const { id, name, category, priceM, autoUpdate } = req.body;
    if (!name || !category || priceM === undefined) {
      return res.status(400).json({ success: false, error: 'Name, category, and priceM are required' });
    }

    const session = (req as any).staffSession;
    const { result, sources } = await researchSingleItem(
      { id, name, category, priceM: String(priceM) },
      session.staffId,
      autoUpdate
    );

    res.json({ success: true, result, sources });
  } catch (err: any) {
    console.error('Single item research error:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to research item' });
  }
});

// 20. Batch Research Items (All or by Category) (Admin Only)
app.post('/api/admin/research/batch', requireStaffAuth, async (req, res) => {
  try {
    const { category, autoUpdate } = req.body;
    const session = (req as any).staffSession;

    const allServices = await dbRepository.getServices();
    let targets = allServices;
    if (category && category !== 'all') {
      targets = allServices.filter(s => s.category.toLowerCase() === String(category).toLowerCase());
    }

    if (targets.length === 0) {
      return res.status(400).json({ success: false, error: 'No items found matching the selected category' });
    }

    const payload = targets.map(t => ({
      id: t.id,
      name: t.name,
      category: t.category,
      priceM: t.priceM,
    }));

    const results = await researchCatalogItems(payload, session.staffId, autoUpdate);
    res.json({ success: true, count: results.length, results });
  } catch (err: any) {
    console.error('Batch research error:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to execute batch research' });
  }
});

// 21. Approve Researched Value & Apply to Official Catalogue (Admin Only)
app.post('/api/admin/research/:id/approve', requireStaffAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { overrideValueM } = req.body;
    const session = (req as any).staffSession;

    const outcome = await dbRepository.approveResearchResult(id, session.staffId, overrideValueM);
    res.json({ 
      success: true, 
      message: 'Value approved and published to official catalogue!',
      service: outcome.service,
      research: outcome.research 
    });
  } catch (err: any) {
    console.error('Approve research error:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to approve research value' });
  }
});

// 22. Reject Researched Value (Admin Only)
app.post('/api/admin/research/:id/reject', requireStaffAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const session = (req as any).staffSession;

    const rejected = await dbRepository.rejectResearchResult(id, session.staffId, reason);
    if (!rejected) {
      return res.status(404).json({ success: false, error: 'Research record not found' });
    }

    res.json({ success: true, research: rejected });
  } catch (err: any) {
    console.error('Reject research error:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to reject research value' });
  }
});

// 23. Manually Edit Proposed Researched Value (Admin Only)
app.put('/api/admin/research/:id/edit', requireStaffAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { updatedValueM, notes } = req.body;

    if (!updatedValueM || isNaN(parseFloat(updatedValueM))) {
      return res.status(400).json({ success: false, error: 'Valid numeric updatedValueM is required' });
    }

    const updated = await dbRepository.editResearchResult(id, String(updatedValueM), notes);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Research record not found' });
    }

    res.json({ success: true, research: updated });
  } catch (err: any) {
    console.error('Edit research error:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to update research value' });
  }
});

// 24. Value History Audit Log (Admin Only)
app.get('/api/admin/research/history', requireStaffAuth, async (req, res) => {
  try {
    const itemId = req.query.itemId?.toString();
    const history = await dbRepository.listValueHistory(itemId);
    res.json({ success: true, history });
  } catch (err: any) {
    console.error('List value history error:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve value history' });
  }
});

// 25. Get / Update Research Schedule Configuration (Admin Only)
app.get('/api/admin/research/schedule', requireStaffAuth, async (_req, res) => {
  try {
    const config = await dbRepository.getResearchScheduleConfig();
    res.json({ success: true, config });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to retrieve schedule config' });
  }
});

app.post('/api/admin/research/schedule', requireStaffAuth, async (req, res) => {
  try {
    const { enabled, autoUpdateEnabled, minSources, maxAllowedPercentChange, intervalHours, targetCategories } = req.body;
    const updateData: any = {};
    if (typeof enabled === 'boolean') updateData.enabled = enabled;
    if (typeof autoUpdateEnabled === 'boolean') updateData.autoUpdateEnabled = autoUpdateEnabled;
    if (minSources !== undefined && !isNaN(parseInt(minSources, 10))) {
      updateData.minSources = Math.max(1, parseInt(minSources, 10));
    }
    if (maxAllowedPercentChange !== undefined && !isNaN(parseFloat(maxAllowedPercentChange))) {
      updateData.maxAllowedPercentChange = Math.max(1, parseFloat(maxAllowedPercentChange));
    }
    if (intervalHours && !isNaN(parseInt(intervalHours, 10))) {
      updateData.intervalHours = Math.max(1, parseInt(intervalHours, 10));
    }
    if (Array.isArray(targetCategories)) updateData.targetCategories = targetCategories;

    const updated = await dbRepository.updateResearchScheduleConfig(updateData);
    res.json({ success: true, config: updated });
  } catch (err: any) {
    console.error('Update schedule error:', err);
    res.status(500).json({ success: false, error: 'Failed to update schedule config' });
  }
});

// In-memory rate limiting, duplicate execution prevention, and cooldown for research cron
let lastCronExecutionTime = 0;
let isCronRunning = false;
const CRON_SECRET = process.env.CRON_SECRET || 'bfs_cron_secret_2026';

// 26. Persistent Cron Webhook Endpoint for External Schedulers (Protected by CRON_SECRET)
app.all('/api/cron/research-update', async (req, res) => {
  try {
    // 1. Authenticate secret (Bearer token, x-cron-secret header, or ?secret query param)
    const authHeader = req.get('authorization') || '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const headerSecret = req.headers['x-cron-secret']?.toString() || '';
    const querySecret = req.query.secret?.toString() || '';
    const providedSecret = bearerToken || headerSecret || querySecret;

    const isTest = process.env.NODE_ENV === 'test';
    // If not in test mode, strictly require secret matching CRON_SECRET
    // If in test mode, require secret if provided, or allow if CRON_SECRET matches provided
    if (providedSecret !== CRON_SECRET && !(isTest && !providedSecret)) {
      return res.status(401).json({ 
        success: false, 
        error: 'Unauthorized: Invalid or missing cron secret. Please provide matching Bearer token or x-cron-secret header.' 
      });
    }

    // 2. Prevent overlapping / duplicate concurrent runs
    if (isCronRunning) {
      return res.status(409).json({ 
        success: false, 
        error: 'Research cycle already in progress. Duplicate execution prevented.' 
      });
    }

    // 3. Minimum cooldown (4 hours unless force flag is passed or running in test)
    const now = Date.now();
    const fourHoursMs = 4 * 60 * 60 * 1000;
    const isForced = req.query.force === 'true' || isTest;
    if (!isForced && (now - lastCronExecutionTime < fourHoursMs)) {
      const waitMin = Math.ceil((fourHoursMs - (now - lastCronExecutionTime)) / 60000);
      return res.json({
        success: true,
        status: 'skipped',
        reason: `Cooldown active. Minimum 4 hours between full passes. Next run available in ${waitMin} minutes.`,
        lastExecutedAt: new Date(lastCronExecutionTime).toISOString(),
      });
    }

    isCronRunning = true;
    try {
      lastCronExecutionTime = now;
      const cycle = await executeScheduledResearchCycle('External Cron Runner');
      res.json({
        success: true,
        executedAt: new Date().toISOString(),
        ...cycle,
        message: 'Automated live value research and catalogue update cycle completed.',
      });
    } finally {
      isCronRunning = false;
    }
  } catch (err: any) {
    isCronRunning = false;
    console.error('Cron research update error:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to execute cron research update' });
  }
});

// 27. Automatic Item Discovery & Mutation Hierarchy Endpoint
app.post('/api/admin/discovery', requireStaffAuth, async (req, res) => {
  try {
    const session = (req as any).staffSession;
    const discovery = await discoverNewItemsAndVariants(session.staffId);
    res.json({
      success: true,
      executedAt: new Date().toISOString(),
      ...discovery,
    });
  } catch (err: any) {
    console.error('Discovery error:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to run item discovery' });
  }
});

// 28. Safe Migration from Neon PostgreSQL to Firestore (Admin Only)
app.post('/api/admin/migrate-to-firestore', requireStaffAuth, async (_req, res) => {
  try {
    const result = await migrateNeonToFirestore();
    res.json({
      message: 'Neon PostgreSQL data successfully migrated and verified in Cloud Firestore!',
      ...result,
    });
  } catch (err: any) {
    console.error('Migration error:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to migrate to Firestore' });
  }
});

// 29. Firebase Authentication Check & Session Bridge
app.post('/api/auth/verify-firebase', async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ success: false, error: 'Firebase ID token is required' });
    }

    const verification = await verifyFirebaseIdToken(idToken);
    if (!verification) {
      return res.status(401).json({ success: false, error: 'Invalid Firebase ID token' });
    }

    if (!verification.isAdmin) {
      return res.status(403).json({ 
        success: false, 
        isAdmin: false, 
        email: verification.email,
        error: 'Forbidden: Account does not possess admin custom claim.' 
      });
    }

    const proto = (req.headers['x-forwarded-proto'] || req.protocol || '').toString().toLowerCase();
    const host = (req.headers['host'] || '').toLowerCase();
    const isHttps = req.secure || proto.includes('https') || host.includes('run.app') || process.env.NODE_ENV === 'production' || !!process.env.VERCEL;

    const cookieOpts = isHttps
      ? `bfs_staff_session=${idToken}; Path=/; HttpOnly; SameSite=None; Secure; Partitioned; Max-Age=86400`
      : `bfs_staff_session=${idToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`;

    res.setHeader('Set-Cookie', cookieOpts);

    res.json({
      success: true,
      uid: verification.uid,
      email: verification.email,
      isAdmin: true,
      token: idToken,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Firebase authentication verification failed' });
  }
});

// 30. Server-controlled Custom Claim assignment endpoint (Authorized Staff Only)
app.post('/api/admin/set-claim', requireStaffAuth, async (req, res) => {
  try {
    const { targetUid, isAdmin } = req.body;
    if (!targetUid) {
      return res.status(400).json({ success: false, error: 'targetUid is required' });
    }
    const { setAdminCustomClaim } = await import('./src/server/firebaseAdmin.ts');
    const success = await setAdminCustomClaim(targetUid, isAdmin !== false);
    res.json({ success, targetUid, isAdmin: isAdmin !== false });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to set claim' });
  }
});

export { app };
export default app;

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  // Initialize Neon PostgreSQL database schema and seed if configured
  if (isNeonConfigured()) {
    try {
      console.log('Neon PostgreSQL configured. Ensuring schema tables and initial seed...');
      await ensureNeonSchema();
      const db = getNeonDb();
      if (db) {
        await ensureNeonServicesSeeded(db);
      }
      console.log('Neon PostgreSQL ready.');
    } catch (err) {
      console.error('Warning initializing Neon database at startup:', err);
    }
  }

  // Initialize background value research scheduler
  try {
    initValueResearchScheduler();
  } catch (schedErr) {
    console.warn('Could not start value research scheduler:', schedErr);
  }

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Blox Fruit Services server listening on port ${port} (mode: ${isProd ? 'production' : 'development'})`);
  });
}

// Only start the standalone listener if not invoked as a serverless function (e.g. Vercel) or during testing
const isTestExecution = process.env.NODE_ENV === 'test' || process.argv.some(arg => arg.includes('test'));
if (process.env.VERCEL !== '1' && !isTestExecution) {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
  });
}
