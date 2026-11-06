import { 
  Service, 
  PublicOrder, 
  ProposedItem, 
  Enquiry, 
  CreateEnquiryPayload,
  ServiceEvidence,
  OngoingServiceItem,
  ResearchResult,
  ResearchSource,
  ValueHistoryItem,
  ResearchScheduleConfig,
  MarketTrendFruit
} from '../types/index.ts';

export interface CreateOrderPayload {
  serviceId: string;
  robloxUsername: string;
  timezone: string;
  availability: string;
  paymentType: 'fruits' | 'gamepass' | 'combination';
  items: ProposedItem[];
  customerNote?: string;
  consentPublicProofs?: boolean;
}

export interface CreateOrderResponse {
  success: boolean;
  orderCode?: string;
  publicToken?: string;
  orderId?: string;
  serviceName?: string;
  totalPriceM?: string;
  depositM?: string;
  remainingM?: string;
  error?: string;
}

import { auth, signInWithGoogle, signOutUser } from './firebase.ts';

// Module-level token cache to ensure resilience across async boundaries
let inMemoryStaffToken: string | null = null;

export function getStaffToken(): string | null {
  if (inMemoryStaffToken && inMemoryStaffToken !== 'null' && inMemoryStaffToken !== 'undefined') {
    return inMemoryStaffToken;
  }
  try {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('bfs_staff_token') || sessionStorage.getItem('bfs_staff_token');
      if (stored && stored !== 'null' && stored !== 'undefined') {
        inMemoryStaffToken = stored;
        return stored;
      }
    }
  } catch {}
  return null;
}

export function setStaffToken(token: string): void {
  inMemoryStaffToken = token;
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem('bfs_staff_token', token);
      sessionStorage.setItem('bfs_staff_token', token);
    }
  } catch {}
}

export function clearStaffToken(): void {
  inMemoryStaffToken = null;
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('bfs_staff_token');
      sessionStorage.removeItem('bfs_staff_token');
    }
  } catch {}
}

export function getAdminHeaders(additional: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { ...additional };
  const token = getStaffToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export const api = {
  async getServices(): Promise<Service[]> {
    const res = await fetch('/api/services');
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch services');
    }
    return data.services;
  },

  async getService(slugOrId: string): Promise<Service> {
    const res = await fetch(`/api/services/${encodeURIComponent(slugOrId)}`);
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch service');
    }
    return data.service;
  },

  async submitOrder(payload: CreateOrderPayload): Promise<CreateOrderResponse> {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to submit order');
    }
    return data;
  },

  async getOrderStatus(publicToken: string): Promise<PublicOrder> {
    const res = await fetch(`/api/orders/track/${encodeURIComponent(publicToken)}`);
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Order not found or invalid link');
    }
    return data.order;
  },

  // --- CUSTOMER SERVICE (SUPPORT) ---
  async submitEnquiry(payload: {
    robloxUsername: string;
    customerName?: string;
    discordTag?: string;
    orderCodeOrId?: string;
    subject: string;
    message: string;
  }): Promise<{ success: boolean; enquiryId: string; message: string }> {
    const res = await fetch('/api/support/enquiries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to submit support enquiry');
    }
    return data;
  },

  // --- PROOFS & ONGOING CARRIES ---
  async getPublicProofs(): Promise<ServiceEvidence[]> {
    const res = await fetch('/api/proofs');
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch proofs');
    }
    return data.proofs;
  },

  async getOngoingCarries(): Promise<OngoingServiceItem[]> {
    const res = await fetch('/api/ongoing');
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch active carries');
    }
    return data.activeCarries;
  },

  // --- ADMIN AUTH (DUAL BEARER TOKEN + HTTP-ONLY COOKIE) ---
  getStaffToken(): string | null {
    return getStaffToken();
  },

  setStaffToken(token: string): void {
    setStaffToken(token);
  },

  clearStaffToken(): void {
    clearStaffToken();
  },

  getAdminHeaders(additional: Record<string, string> = {}): Record<string, string> {
    return getAdminHeaders(additional);
  },

  async adminLogin(password: string): Promise<{ success: boolean; role: string; token?: string }> {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Login failed');
    }
    if (data.token) {
      setStaffToken(data.token);
    }
    return data;
  },

  async adminLoginWithGoogle(): Promise<{ success: boolean; role: string; token: string; email?: string }> {
    const user = await signInWithGoogle();
    if (!user) {
      throw new Error('Google sign-in was cancelled or aborted.');
    }

    // Force refresh ID token to get the server-minted claim
    let tokenResult = await user.getIdTokenResult(true);

    // Call verify-firebase on server to verify/mint the custom claim
    const verifyRes = await fetch('/api/auth/verify-firebase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: tokenResult.token }),
    });

    const verifyData = await verifyRes.json();
    if (!verifyRes.ok || !verifyData.success || !verifyData.isAdmin) {
      await signOutUser();
      clearStaffToken();
      throw new Error(
        verifyData.error || `Access Denied: Google account (${user.email}) does not possess administrative privileges.`
      );
    }

    // Refresh token again in case the server just assigned the custom claim during verification
    tokenResult = await user.getIdTokenResult(true);
    if (!tokenResult.claims.admin) {
      await new Promise(r => setTimeout(r, 600));
      tokenResult = await user.getIdTokenResult(true);
    }

    if (!tokenResult.claims.admin) {
      await signOutUser();
      clearStaffToken();
      throw new Error(`Access Denied: Admin custom claim could not be confirmed for ${user.email}.`);
    }

    setStaffToken(tokenResult.token);
    return {
      success: true,
      role: 'staff',
      token: tokenResult.token,
      email: user.email || undefined,
    };
  },

  async adminLogout(): Promise<void> {
    try {
      await signOutUser();
    } catch (e) {
      console.warn('Firebase sign out error:', e);
    }
    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
        credentials: 'include',
        headers: getAdminHeaders({ 'Content-Type': 'application/json' }),
      });
    } catch (e) {
      console.warn('Logout request failed:', e);
    } finally {
      clearStaffToken();
    }
  },

  async adminCheckSession(): Promise<boolean> {
    try {
      // 1. If Firebase Auth is initialized and user is signed in
      if (typeof window !== 'undefined') {
        const currentUser = auth.currentUser;
        if (currentUser) {
          // Force refresh ID token to inspect active custom claims
          const tokenResult = await currentUser.getIdTokenResult(true);
          const hasAdminClaim = Boolean(tokenResult.claims && tokenResult.claims.admin === true);

          if (!hasAdminClaim) {
            // Strictly clear any cached token and reject if admin claim is missing
            clearStaffToken();
            return false;
          }

          // Cache the valid admin token
          setStaffToken(tokenResult.token);

          // Verify with backend
          const res = await fetch('/api/admin/me', {
            credentials: 'include',
            headers: {
              'Authorization': `Bearer ${tokenResult.token}`
            },
          });
          const data = await res.json();
          if (res.ok && data.success && (data.isAdmin || data.role === 'staff')) {
            return true;
          }
          clearStaffToken();
          return false;
        }
      }

      // 2. Check stored session token (e.g. for API/token persistence)
      const token = getStaffToken();
      if (!token) return false;

      // If token is a Firebase JWT (3 segments), verify claim directly before sending
      if (token.split('.').length === 3) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          if (payload.admin !== true) {
            clearStaffToken();
            return false;
          }
        } catch {
          clearStaffToken();
          return false;
        }
      }

      const res = await fetch('/api/admin/me', {
        credentials: 'include',
        headers: getAdminHeaders(),
      });
      const data = await res.json();
      if (res.ok && data.success && (data.isAdmin || data.role === 'staff')) {
        return true;
      }
      clearStaffToken();
      return false;
    } catch {
      clearStaffToken();
      return false;
    }
  },

  // --- ADMIN ORDERS ---
  async adminGetOrders(status?: string, search?: string): Promise<any[]> {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (search) params.set('search', search);

    const res = await fetch(`/api/admin/orders?${params.toString()}`, {
      credentials: 'include',
      headers: getAdminHeaders(),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to fetch admin orders');
    }
    return data.orders;
  },

  async adminGetOrder(id: string): Promise<any> {
    const res = await fetch(`/api/admin/orders/${encodeURIComponent(id)}`, {
      credentials: 'include',
      headers: getAdminHeaders(),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to fetch order detail');
    }
    return data.order;
  },

  async adminUpdateOrderStatus(id: string, status: string, note?: string): Promise<void> {
    const res = await fetch(`/api/admin/orders/${encodeURIComponent(id)}/status`, {
      method: 'POST',
      credentials: 'include',
      headers: getAdminHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ status, note }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to update order status');
    }
  },

  async adminUpdateItemValuation(orderId: string, itemId: string, agreedValueM: number | null, verified: boolean): Promise<void> {
    const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/items/${encodeURIComponent(itemId)}`, {
      method: 'POST',
      credentials: 'include',
      headers: getAdminHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ agreedValueM, verified }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to update item valuation');
    }
  },

  async adminRecordPayment(orderId: string, kind: 'deposit' | 'remaining', amountM: number, itemsJson: string, staffName: string): Promise<void> {
    const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/payments`, {
      method: 'POST',
      credentials: 'include',
      headers: getAdminHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ kind, amountM, itemsJson, staffName }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to record payment');
    }
  },

  async adminUpdateStaffNotes(orderId: string, staffNotes: string): Promise<void> {
    const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/notes`, {
      method: 'POST',
      credentials: 'include',
      headers: getAdminHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ staffNotes }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to update staff notes');
    }
  },

  // --- STAFF SUPPORT INBOX ---
  async adminGetEnquiries(status?: string, search?: string): Promise<Enquiry[]> {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (search) params.set('search', search);

    const res = await fetch(`/api/admin/enquiries?${params.toString()}`, {
      credentials: 'include',
      headers: getAdminHeaders(),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to fetch enquiries');
    }
    return data.enquiries;
  },

  async adminCreateManualEnquiry(payload: CreateEnquiryPayload): Promise<Enquiry> {
    const res = await fetch('/api/admin/enquiries', {
      method: 'POST',
      credentials: 'include',
      headers: getAdminHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to log manual enquiry');
    }
    return data.enquiry;
  },

  async adminUpdateEnquiryStatus(id: string, status: 'pending' | 'in_progress' | 'resolved', staffNotes?: string): Promise<Enquiry> {
    const res = await fetch(`/api/admin/enquiries/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: getAdminHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ status, staffNotes }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to update enquiry status');
    }
    return data.enquiry;
  },

  // --- EVIDENCE & PROOFS MODERATION ---
  async adminGetOrderEvidence(orderId: string): Promise<ServiceEvidence[]> {
    const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/evidence`, {
      credentials: 'include',
      headers: getAdminHeaders(),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to fetch evidence');
    }
    return data.evidence;
  },

  async adminRecordOrderEvidence(orderId: string, payload: {
    evidenceType: 'screenshot' | 'video_link' | 'screen_share_session';
    mediaUrl: string;
    notes?: string;
    customerConsentPublic: boolean;
    staffApprovedPublic: boolean;
    isOngoing?: boolean;
    isCompleted?: boolean;
  }): Promise<ServiceEvidence> {
    const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/evidence`, {
      method: 'POST',
      credentials: 'include',
      headers: getAdminHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to record evidence');
    }
    return data.evidence;
  },

  async adminToggleEvidenceApproval(evidenceId: string, staffApprovedPublic: boolean): Promise<ServiceEvidence> {
    const res = await fetch(`/api/admin/evidence/${encodeURIComponent(evidenceId)}/approval`, {
      method: 'POST',
      credentials: 'include',
      headers: getAdminHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ staffApprovedPublic }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to toggle evidence approval');
    }
    return data.evidence;
  },

  // --- CATALOG CRUD (CHANGE CATALOGUE) ---
  async adminGetCatalog(): Promise<Service[]> {
    const res = await fetch('/api/admin/catalog', {
      credentials: 'include',
      headers: getAdminHeaders(),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to fetch catalog');
    }
    return data.services;
  },

  async adminCreateService(payload: Partial<Service>): Promise<Service> {
    const res = await fetch('/api/admin/catalog', {
      method: 'POST',
      credentials: 'include',
      headers: getAdminHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to create service');
    }
    return data.service;
  },

  async adminUpdateService(id: string, updates: Partial<Service>): Promise<Service> {
    const res = await fetch(`/api/admin/catalog/${encodeURIComponent(id)}`, {
      method: 'PUT',
      credentials: 'include',
      headers: getAdminHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to update service');
    }
    return data.service;
  },

  async adminDeleteService(id: string): Promise<void> {
    const res = await fetch(`/api/admin/catalog/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: getAdminHeaders(),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to delete service');
    }
  },

  // --- VALUE RESEARCH & MARKET VERIFICATION ---
  async getMarketStatus(): Promise<{
    success: boolean;
    lastVerifiedAt: string | null;
    totalApprovedUpdates: number;
    recentApprovalsCount: number;
    note: string;
  }> {
    const res = await fetch('/api/public/market-status');
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to fetch market status');
    }
    return data;
  },

  async getMarketTrends(refresh = false): Promise<{
    trends: MarketTrendFruit[];
    lastUpdated: string;
    isLiveGrounding: boolean;
    source: string;
  }> {
    const res = await fetch(`/api/public/market-trends${refresh ? '?refresh=true' : ''}`);
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to fetch market trends');
    }
    return data;
  },

  async adminGetResearch(filters?: { status?: string; category?: string; search?: string }): Promise<ResearchResult[]> {
    const params = new URLSearchParams();
    if (filters?.status && filters.status !== 'all') params.append('status', filters.status);
    if (filters?.category && filters.category !== 'all') params.append('category', filters.category);
    if (filters?.search) params.append('search', filters.search);

    const res = await fetch(`/api/admin/research?${params.toString()}`, {
      credentials: 'include',
      headers: getAdminHeaders(),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to fetch research items');
    }
    return data.results;
  },

  async adminResearchSingleItem(payload: { id?: string; name: string; category: string; priceM: string; autoUpdate?: boolean }): Promise<{
    result: ResearchResult;
    sources: ResearchSource[];
  }> {
    const res = await fetch('/api/admin/research/single', {
      method: 'POST',
      credentials: 'include',
      headers: getAdminHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to research item');
    }
    return data;
  },

  async adminResearchBatch(payload?: { category?: string; autoUpdate?: boolean }): Promise<ResearchResult[]> {
    const res = await fetch('/api/admin/research/batch', {
      method: 'POST',
      credentials: 'include',
      headers: getAdminHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload || {}),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to execute batch research');
    }
    return data.results;
  },

  async triggerCronResearchUpdate(): Promise<any> {
    const res = await fetch('/api/cron/research-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to trigger scheduled update');
    }
    return data;
  },

  async adminApproveResearch(id: string, overrideValueM?: string): Promise<{
    success: boolean;
    service?: Service;
    research: ResearchResult;
    message: string;
  }> {
    const res = await fetch(`/api/admin/research/${encodeURIComponent(id)}/approve`, {
      method: 'POST',
      credentials: 'include',
      headers: getAdminHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ overrideValueM }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to approve research value');
    }
    return data;
  },

  async adminRejectResearch(id: string, reason?: string): Promise<ResearchResult> {
    const res = await fetch(`/api/admin/research/${encodeURIComponent(id)}/reject`, {
      method: 'POST',
      credentials: 'include',
      headers: getAdminHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ reason }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to reject research value');
    }
    return data.research;
  },

  async adminEditResearch(id: string, updatedValueM: string, notes?: string): Promise<ResearchResult> {
    const res = await fetch(`/api/admin/research/${encodeURIComponent(id)}/edit`, {
      method: 'PUT',
      credentials: 'include',
      headers: getAdminHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ updatedValueM, notes }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to update research value');
    }
    return data.research;
  },

  async adminGetValueHistory(itemId?: string): Promise<ValueHistoryItem[]> {
    const url = itemId 
      ? `/api/admin/research/history?itemId=${encodeURIComponent(itemId)}` 
      : '/api/admin/research/history';
    const res = await fetch(url, {
      credentials: 'include',
      headers: getAdminHeaders(),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to fetch value history');
    }
    return data.history;
  },

  async adminGetResearchSchedule(): Promise<ResearchScheduleConfig> {
    const res = await fetch('/api/admin/research/schedule', {
      credentials: 'include',
      headers: getAdminHeaders(),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to fetch schedule config');
    }
    return data.config;
  },

  async adminUpdateResearchSchedule(payload: Partial<ResearchScheduleConfig>): Promise<ResearchScheduleConfig> {
    const res = await fetch('/api/admin/research/schedule', {
      method: 'POST',
      credentials: 'include',
      headers: getAdminHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to update schedule config');
    }
    return data.config;
  },
};
