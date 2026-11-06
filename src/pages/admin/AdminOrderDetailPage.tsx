import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  ShieldCheck, 
  Check, 
  X, 
  AlertCircle, 
  Coins, 
  Play, 
  CheckCircle2, 
  Save, 
  FileText,
  Clock,
  User,
  Sparkles
} from 'lucide-react';
import { api } from '../../lib/api.ts';
import { toMillionString } from '../../lib/calculator.ts';

interface AdminOrderDetailPageProps {
  orderId: string;
  onNavigate: (path: string) => void;
}

export const AdminOrderDetailPage: React.FC<AdminOrderDetailPageProps> = ({ 
  orderId, 
  onNavigate 
}) => {
  const [order, setOrder] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Staff notes state
  const [staffNotes, setStaffNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  // Action modal / prompt states
  const [activeModal, setActiveModal] = useState<
    | null 
    | 'accept' 
    | 'reject' 
    | 'more_info' 
    | 'deposit' 
    | 'remaining' 
    | 'cancel'
  >(null);
  const [actionReason, setActionReason] = useState('');
  const [staffOperatorName, setStaffOperatorName] = useState('Staff');
  const [paymentAmountM, setPaymentAmountM] = useState('');
  const [paymentItemsText, setPaymentItemsText] = useState('');

  // Item valuation states (itemId -> agreedValueM)
  const [itemValues, setItemValues] = useState<Record<string, string>>({});
  const [itemVerified, setItemVerified] = useState<Record<string, boolean>>({});

  // Evidence & Screen-sharing states
  const [evidenceList, setEvidenceList] = useState<any[]>([]);
  const [showAddEvidence, setShowAddEvidence] = useState(false);
  const [evidenceForm, setEvidenceForm] = useState({
    evidenceType: 'screenshot' as 'screenshot' | 'video_link' | 'screen_share_session',
    mediaUrl: '',
    notes: '',
    staffApprovedPublic: false,
  });
  const [savingEvidence, setSavingEvidence] = useState(false);

  const loadEvidence = async (targetOrderId: string) => {
    try {
      const list = await api.adminGetOrderEvidence(targetOrderId);
      setEvidenceList(list);
    } catch (err) {
      console.warn('Failed to load evidence:', err);
    }
  };

  const loadOrderDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.adminGetOrder(orderId);
      setOrder(data);
      setStaffNotes(data.staffNotes || '');

      // Initialize item valuation editors
      const valMap: Record<string, string> = {};
      const verMap: Record<string, boolean> = {};
      for (const item of data.items || []) {
        valMap[item.id] = item.agreedValueM || item.proposedValueM || '0';
        verMap[item.id] = Boolean(item.verified);
      }
      setItemValues(valMap);
      setItemVerified(verMap);

      await loadEvidence(data.id);
    } catch (err: any) {
      setError(err.message || 'Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrderDetail();
  }, [orderId]);

  const showSuccessNotice = (msg: string) => {
    setActionSuccess(msg);
    setTimeout(() => setActionSuccess(null), 3000);
  };

  // 1. Save Staff Notes
  const handleSaveNotes = async () => {
    setSavingNotes(true);
    try {
      await api.adminUpdateStaffNotes(order.id, staffNotes);
      showSuccessNotice('Internal staff notes saved');
      await loadOrderDetail();
    } catch (err: any) {
      alert(err.message || 'Failed to save staff notes');
    } finally {
      setSavingNotes(false);
    }
  };

  // Toggle evidence public approval
  const handleToggleApproval = async (evId: string, current: boolean) => {
    try {
      await api.adminToggleEvidenceApproval(evId, !current);
      await loadEvidence(order.id);
      showSuccessNotice(!current ? 'Approved for public Proofs showcase' : 'Removed from public Proofs showcase');
    } catch (err: any) {
      alert(err.message || 'Failed to update approval');
    }
  };

  // Save new evidence
  const handleSaveEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evidenceForm.mediaUrl.trim()) return;
    setSavingEvidence(true);
    try {
      await api.adminRecordOrderEvidence(order.id, {
        evidenceType: evidenceForm.evidenceType,
        mediaUrl: evidenceForm.mediaUrl.trim(),
        notes: evidenceForm.notes.trim() || undefined,
        customerConsentPublic: Boolean(order.consentPublicProofs),
        staffApprovedPublic: evidenceForm.staffApprovedPublic,
      });
      setShowAddEvidence(false);
      setEvidenceForm({ evidenceType: 'screenshot', mediaUrl: '', notes: '', staffApprovedPublic: false });
      await loadEvidence(order.id);
      showSuccessNotice('Evidence attached to order');
    } catch (err: any) {
      alert(err.message || 'Failed to attach evidence');
    } finally {
      setSavingEvidence(false);
    }
  };

  // 2. Update Single Item Valuation
  const handleSaveItemValuation = async (item: any) => {
    const val = parseFloat(itemValues[item.id] || '0');
    const isVer = Boolean(itemVerified[item.id]);
    try {
      await api.adminUpdateItemValuation(order.id, item.id, val, isVer);
      showSuccessNotice(`Updated valuation for ${item.itemName}`);
      await loadOrderDetail();
    } catch (err: any) {
      alert(err.message || 'Failed to update item valuation');
    }
  };

  // 3. Status Action Handler
  const handleExecuteStatusAction = async () => {
    if (!order) return;
    try {
      if (activeModal === 'accept') {
        await api.adminUpdateOrderStatus(order.id, 'accepted', actionReason || 'Offer accepted by staff. Awaiting in-game deposit trade.');
      } else if (activeModal === 'reject') {
        if (!actionReason.trim()) {
          alert('Please enter a rejection reason.');
          return;
        }
        await api.adminUpdateOrderStatus(order.id, 'rejected', `Offer rejected: ${actionReason}`);
      } else if (activeModal === 'more_info') {
        if (!actionReason.trim()) {
          alert('Please enter what information is needed from customer.');
          return;
        }
        await api.adminUpdateOrderStatus(order.id, 'more_info_needed', `Information needed: ${actionReason}`);
      } else if (activeModal === 'cancel') {
        if (!actionReason.trim()) {
          alert('Please enter a cancellation reason.');
          return;
        }
        await api.adminUpdateOrderStatus(order.id, 'cancelled', `Order cancelled: ${actionReason}`);
      }

      setActiveModal(null);
      setActionReason('');
      showSuccessNotice('Order status updated successfully');
      await loadOrderDetail();
    } catch (err: any) {
      alert(err.message || 'Status action failed');
    }
  };

  // 4. Record Payment Handler
  const handleExecutePayment = async (kind: 'deposit' | 'remaining') => {
    if (!order) return;
    const amountNum = parseFloat(paymentAmountM);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('Please enter a valid payment amount in M');
      return;
    }

    try {
      await api.adminRecordPayment(
        order.id,
        kind,
        amountNum,
        paymentItemsText.trim() || 'In-game trade items surrendered',
        staffOperatorName.trim() || 'Staff'
      );
      setActiveModal(null);
      setPaymentAmountM('');
      setPaymentItemsText('');
      showSuccessNotice(`${kind === 'deposit' ? '50% Deposit' : 'Remaining balance'} recorded!`);
      await loadOrderDetail();
    } catch (err: any) {
      alert(err.message || 'Payment recording failed');
    }
  };

  // Direct status transition buttons
  const handleQuickStatusChange = async (status: string, note: string) => {
    if (!confirm(`Are you sure you want to mark this order as "${status.replace(/_/g, ' ')}"?`)) return;
    try {
      await api.adminUpdateOrderStatus(order.id, status, note);
      showSuccessNotice(`Status changed to ${status}`);
      await loadOrderDetail();
    } catch (err: any) {
      alert(err.message || 'Action failed');
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-slate-500 text-sm">
        Loading order details...
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
        <h2 className="text-lg font-bold text-white">Order Not Found</h2>
        <p className="text-xs text-slate-400">{error}</p>
        <button
          onClick={() => onNavigate('/admin')}
          className="px-4 py-2 bg-slate-800 text-xs text-slate-300 rounded-lg hover:text-white"
        >
          Back to Orders
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6 pb-28">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <button
          onClick={() => onNavigate('/admin')}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to All Orders</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Order Status:</span>
          <span className="px-3 py-1 bg-amber-400/10 border border-amber-400/30 text-amber-300 rounded-full text-xs font-bold uppercase font-mono">
            {order.status.replace(/_/g, ' ')}
          </span>
        </div>
      </div>

      {actionSuccess && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-xs text-emerald-300 flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Main Order Header Summary */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <span className="text-[11px] font-mono text-slate-500 uppercase">Order Code</span>
            <div className="text-3xl font-extrabold text-white font-mono tracking-tight">
              {order.orderCode}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Customer Public Token: <code className="text-slate-300 font-mono text-[11px]">{order.publicToken}</code>
            </div>
          </div>

          <div className="text-right font-mono">
            <span className="text-[11px] text-slate-500 uppercase block">Total Trade Value</span>
            <span className="text-2xl font-bold text-amber-400">{order.totalPriceM}M</span>
            <div className="text-[11px] text-slate-400">
              50% Deposit: <strong className="text-amber-300">{order.depositM}M</strong> · 
              Remaining: <strong className="text-slate-300">{order.remainingM}M</strong>
            </div>
          </div>
        </div>

        {/* Customer & Service Info 2-Column Split */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          {/* Customer Details */}
          <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 space-y-2.5">
            <h4 className="font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-amber-400" />
              <span>Customer In-Game Info</span>
            </h4>
            <div className="flex justify-between py-1 border-b border-slate-900">
              <span className="text-slate-400">Roblox Username:</span>
              <span className="font-mono font-bold text-white text-sm">@{order.robloxUsername}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-900">
              <span className="text-slate-400">Timezone:</span>
              <span className="text-slate-200">{order.timezone}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-900">
              <span className="text-slate-400">Availability:</span>
              <span className="text-slate-200">{order.availability}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-900">
              <span className="text-slate-400">Payment Category:</span>
              <span className="text-slate-200 capitalize">{order.paymentType}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-900">
              <span className="text-slate-400">Public Proofs Consent:</span>
              <span className={`font-semibold ${order.consentPublicProofs ? 'text-emerald-400' : 'text-slate-400'}`}>
                {order.consentPublicProofs ? '✓ Consented to Showcase' : 'Anonymity Requested'}
              </span>
            </div>
            {order.customerNote && (
              <div className="pt-1 text-slate-400">
                <span className="text-slate-500 block mb-0.5">Customer Note:</span>
                <span className="bg-slate-900 p-2 rounded-lg block text-slate-300">{order.customerNote}</span>
              </div>
            )}
          </div>

          {/* Service Details */}
          <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 space-y-2.5">
            <h4 className="font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Requested Service</span>
            </h4>
            <div className="flex justify-between py-1 border-b border-slate-900">
              <span className="text-slate-400">Service:</span>
              <span className="font-bold text-white">{order.serviceName}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-900">
              <span className="text-slate-400">Category:</span>
              <span className="text-slate-200">{order.serviceCategory}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-900">
              <span className="text-slate-400">Catalog Price:</span>
              <span className="font-mono font-bold text-amber-400">{order.servicePriceM}M</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-400">Order Placed:</span>
              <span className="text-slate-400">{new Date(order.createdAt).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* STAFF ACTION TOOLBAR */}
        <div className="space-y-3 pt-2">
          <div className="text-xs font-semibold text-white uppercase tracking-wider">
            Staff Actions & Status Controls
          </div>

          <div className="flex flex-wrap gap-2">
            {order.status === 'pending_review' && (
              <>
                <button
                  onClick={() => {
                    setActiveModal('accept');
                    setActionReason('Offer accepted. Staff will reach out to trade 50% deposit in-game.');
                  }}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition-colors shadow-sm"
                >
                  Accept Order
                </button>
                <button
                  onClick={() => {
                    setActiveModal('more_info');
                    setActionReason('');
                  }}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs rounded-xl transition-colors"
                >
                  Request More Info
                </button>
                <button
                  onClick={() => {
                    setActiveModal('reject');
                    setActionReason('');
                  }}
                  className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs rounded-xl transition-colors"
                >
                  Reject Order
                </button>
              </>
            )}

            {order.status === 'accepted' && (
              <button
                onClick={() => {
                  setActiveModal('deposit');
                  setPaymentAmountM(order.depositM);
                  setPaymentItemsText('');
                }}
                className="px-5 py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-xs rounded-xl transition-colors shadow-sm flex items-center gap-1.5"
              >
                <Coins className="w-4 h-4" />
                <span>Mark 50% Deposit Received (In-Game Trade)</span>
              </button>
            )}

            {order.status === 'deposit_received' && (
              <button
                onClick={() => handleQuickStatusChange('in_progress', 'Staff commenced co-op carry in-game.')}
                className="px-5 py-2.5 bg-purple-500 hover:bg-purple-400 text-white font-bold text-xs rounded-xl transition-colors shadow-sm flex items-center gap-1.5"
              >
                <Play className="w-4 h-4" />
                <span>Mark Carry In Progress</span>
              </button>
            )}

            {order.status === 'in_progress' && (
              <button
                onClick={() => handleQuickStatusChange('completed', 'Staff completed carry objective. Awaiting remaining 50% balance.')}
                className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition-colors shadow-sm flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Mark Carry Completed</span>
              </button>
            )}

            {order.status === 'completed' && (
              <button
                onClick={() => {
                  setActiveModal('remaining');
                  setPaymentAmountM(order.remainingM);
                  setPaymentItemsText('');
                }}
                className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition-colors shadow-sm flex items-center gap-1.5"
              >
                <Coins className="w-4 h-4" />
                <span>Record Remaining Balance Received (Full Settlement)</span>
              </button>
            )}

            {order.status !== 'cancelled' && order.status !== 'fully_paid' && order.status !== 'rejected' && (
              <button
                onClick={() => {
                  setActiveModal('cancel');
                  setActionReason('');
                }}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-300 text-xs rounded-xl transition-colors"
              >
                Cancel Order
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ITEMS OFFERED & STAFF VERIFICATION CARD */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Items Offered & Staff Verification
            </h3>
            <p className="text-xs text-slate-400">
              Staff manually inspect and confirm agreed trade value for each fruit or gamepass.
            </p>
          </div>
        </div>

        <div className="bg-slate-950 rounded-2xl border border-slate-800 divide-y divide-slate-800/80 overflow-hidden">
          {order.items.map((item: any) => (
            <div key={item.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-sm font-semibold text-white flex items-center gap-2">
                  <span>{item.itemName}</span>
                  <span className="text-slate-500">×{item.quantity}</span>
                  {item.verified ? (
                    <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded font-semibold border border-emerald-500/20">
                      ✓ Verified
                    </span>
                  ) : (
                    <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded font-semibold border border-amber-500/20">
                      Pending Staff Review
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-400 font-mono">
                  Customer Proposed: <strong className="text-slate-300">{item.proposedValueM}M</strong> each
                </div>
              </div>

              {/* Staff Edit Inputs */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <label className="text-[11px] text-slate-400">Agreed (M):</label>
                  <input
                    type="number"
                    step="0.01"
                    value={itemValues[item.id] || ''}
                    onChange={(e) => setItemValues({ ...itemValues, [item.id]: e.target.value })}
                    className="w-20 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-amber-400"
                  />
                </div>

                <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(itemVerified[item.id])}
                    onChange={(e) => setItemVerified({ ...itemVerified, [item.id]: e.target.checked })}
                    className="rounded border-slate-700 text-amber-400 focus:ring-0"
                  />
                  <span>Verified</span>
                </label>

                <button
                  type="button"
                  onClick={() => handleSaveItemValuation(item)}
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 rounded-lg text-xs font-semibold transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* PAYMENTS RECORDED & STAFF NOTES (2-COLUMN GRID) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Payments Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
            <Coins className="w-4 h-4 text-amber-400" />
            <span>Payments Recorded</span>
          </h3>

          {order.payments.length === 0 ? (
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 text-xs text-slate-500 text-center">
              No payments recorded yet. Record 50% deposit upon in-game trade meetup.
            </div>
          ) : (
            <div className="space-y-2">
              {order.payments.map((p: any) => (
                <div key={p.id} className="bg-slate-950 p-3.5 rounded-xl border border-slate-800/80 text-xs space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-white capitalize font-mono">{p.kind} Payment</span>
                    <span className="font-mono font-bold text-emerald-400 text-sm">+{p.amountM}M</span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Recorded by <span className="text-white font-medium">{p.recordedBy}</span> on {new Date(p.recordedAt).toLocaleString()}
                  </div>
                  {p.itemsJson && p.itemsJson !== '[]' && (
                    <div className="text-[11px] text-slate-500 font-mono truncate">
                      Items: {p.itemsJson}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Staff Internal Notes */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl flex flex-col justify-between">
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-amber-400" />
              <span>Internal Staff Notes</span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Private notes visible ONLY to staff members (never exposed to customer).
            </p>
            <textarea
              rows={4}
              value={staffNotes}
              onChange={(e) => setStaffNotes(e.target.value)}
              placeholder="e.g. Added customer on Roblox, scheduled carry for 7pm EST, verified 1x Dough fruit in inventory..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="pt-2 flex justify-end">
            <button
              onClick={handleSaveNotes}
              disabled={savingNotes}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{savingNotes ? 'Saving...' : 'Save Internal Notes'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* SERVICE EVIDENCE & PROOF OF COMPLETION (REQUIREMENT 3 & 4) */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Completion Evidence & Screen-Sharing Verification</span>
            </h3>
            <p className="text-xs text-slate-400">
              Attach screenshots, video recordings, or Discord live screen-share session notes.
            </p>
          </div>

          <button
            onClick={() => setShowAddEvidence(!showAddEvidence)}
            className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors self-start sm:self-auto"
          >
            {showAddEvidence ? 'Cancel' : '+ Attach Evidence'}
          </button>
        </div>

        {/* Screen-Share Safe Coordination Callout */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 text-xs text-slate-300 space-y-1">
          <div className="font-semibold text-amber-300 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            <span>Discord Manual Proof Protocol:</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            All gameplay evidence, screenshots, and live screen-share sessions are managed manually through Discord. Staff record Discord channel links, message references, or session notes below. Evidence published to the public Proofs showcase strictly requires customer consent (currently: <strong className={order.consentPublicProofs ? 'text-emerald-300' : 'text-slate-300'}>{order.consentPublicProofs ? 'Granted' : 'Not Granted'}</strong>).
          </p>
        </div>

        {/* Add Evidence Form */}
        {showAddEvidence && (
          <form onSubmit={handleSaveEvidence} className="bg-slate-950 p-4 rounded-2xl border border-amber-500/30 space-y-3">
            <h4 className="text-xs font-bold text-white uppercase">Record Discord Proof Reference</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Evidence Type</label>
                <select
                  value={evidenceForm.evidenceType}
                  onChange={(e) => setEvidenceForm({ ...evidenceForm, evidenceType: e.target.value as any })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                >
                  <option value="screenshot">Discord Message / Screenshot Link</option>
                  <option value="screen_share_session">Discord Live Screen-Share Session ID / Note</option>
                  <option value="video_link">Video Recording Link (YouTube / Streamable)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Discord Reference / Link / Note <span className="text-amber-400">*</span></label>
                <input
                  type="text"
                  value={evidenceForm.mediaUrl}
                  onChange={(e) => setEvidenceForm({ ...evidenceForm, mediaUrl: e.target.value })}
                  placeholder="e.g. Discord message link, channel #proofs ref, or session ID"
                  required
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Evidence Notes</label>
              <input
                type="text"
                value={evidenceForm.notes}
                onChange={(e) => setEvidenceForm({ ...evidenceForm, notes: e.target.value })}
                placeholder="e.g. Dough Raid completed in 4 minutes, boss cleared on wave 5"
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={evidenceForm.staffApprovedPublic}
                  onChange={(e) => setEvidenceForm({ ...evidenceForm, staffApprovedPublic: e.target.checked })}
                  disabled={!order.consentPublicProofs}
                  className="rounded border-slate-700 text-amber-500 focus:ring-0"
                />
                <span className={order.consentPublicProofs ? 'text-slate-200' : 'text-slate-500'}>
                  Approve for Public Proofs Wall {!order.consentPublicProofs && '(Customer requested anonymity)'}
                </span>
              </label>

              <button
                type="submit"
                disabled={savingEvidence}
                className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition-colors disabled:opacity-50"
              >
                {savingEvidence ? 'Saving...' : 'Save Evidence'}
              </button>
            </div>
          </form>
        )}

        {/* Existing Evidence List */}
        {evidenceList.length === 0 ? (
          <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800/60 text-xs text-slate-500 text-center">
            No evidence items attached yet. Record a screenshot or live screen-share session after carry meetup.
          </div>
        ) : (
          <div className="space-y-2.5">
            {evidenceList.map((ev: any) => (
              <div key={ev.id} className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-semibold text-white">
                    <span className="capitalize px-2 py-0.5 rounded bg-slate-900 text-slate-300 font-mono text-[10px]">
                      {ev.evidenceType.replace(/_/g, ' ')}
                    </span>
                    <a
                      href={ev.mediaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-amber-400 hover:underline truncate max-w-xs block font-mono"
                    >
                      {ev.mediaUrl}
                    </a>
                  </div>
                  {ev.notes && <p className="text-slate-400 italic text-[11px]">"{ev.notes}"</p>}
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                  <button
                    onClick={() => handleToggleApproval(ev.id, ev.staffApprovedPublic)}
                    disabled={!order.consentPublicProofs}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors border ${
                      ev.staffApprovedPublic
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/30'
                        : order.consentPublicProofs
                        ? 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                        : 'bg-slate-900/50 text-slate-600 border-slate-800 cursor-not-allowed'
                    }`}
                  >
                    {ev.staffApprovedPublic ? '✓ Public on Proofs Wall' : 'Approve for Public'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* IMMUTABLE AUDIT TRAIL */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-amber-400" />
          <span>Immutable Audit Log</span>
        </h3>
        <p className="text-[11px] text-slate-400">
          Every staff action, status transition, and payment event is permanently logged with timestamp and actor.
        </p>

        <div className="bg-slate-950 rounded-2xl border border-slate-800 p-4 divide-y divide-slate-800/60 max-h-80 overflow-y-auto">
          {order.auditLogs.map((log: any) => (
            <div key={log.id} className="py-2.5 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-slate-300">
              <div>
                <span className="font-mono text-amber-400 font-semibold mr-2">[{log.action}]</span>
                <span>{log.note || 'No note'}</span>
              </div>
              <div className="text-[11px] text-slate-500 font-mono shrink-0">
                {new Date(log.createdAt).toLocaleString()} · {log.actor}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ACTION DIALOG MODALS */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">
              {activeModal === 'accept' && 'Accept Order & Schedule Escrow'}
              {activeModal === 'reject' && 'Reject Order Offer'}
              {activeModal === 'more_info' && 'Request More Information'}
              {activeModal === 'cancel' && 'Cancel Order'}
              {activeModal === 'deposit' && 'Record In-Game 50% Deposit Received'}
              {activeModal === 'remaining' && 'Record In-Game Remaining Balance Received'}
            </h3>

            {/* Status Modals */}
            {['accept', 'reject', 'more_info', 'cancel'].includes(activeModal) && (
              <div className="space-y-3">
                <label className="block text-xs text-slate-300">
                  {activeModal === 'reject' ? 'Rejection Reason (Required):' : 'Staff Note / Customer Message:'}
                </label>
                <textarea
                  rows={3}
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder="Enter details..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-amber-400"
                />
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setActiveModal(null)}
                    className="px-4 py-2 bg-slate-800 text-xs text-slate-300 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleExecuteStatusAction}
                    className="px-5 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-lg shadow-sm"
                  >
                    Confirm Action
                  </button>
                </div>
              </div>
            )}

            {/* Payment Recording Modals */}
            {(activeModal === 'deposit' || activeModal === 'remaining') && (
              <div className="space-y-3">
                <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl text-[11px] text-amber-200">
                  <strong>Staff Escrow Verification:</strong> Confirm that the customer has successfully traded these items to you in-game via the safe trade window.
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1">
                    Amount Received in Millions (M):
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={paymentAmountM}
                    onChange={(e) => setPaymentAmountM(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1">
                    Items Surrendered by Customer:
                  </label>
                  <input
                    type="text"
                    value={paymentItemsText}
                    onChange={(e) => setPaymentItemsText(e.target.value)}
                    placeholder="e.g. 1x Dough Fruit + 1x Buddha Fruit"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1">
                    Staff Handler Name:
                  </label>
                  <input
                    type="text"
                    value={staffOperatorName}
                    onChange={(e) => setStaffOperatorName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setActiveModal(null)}
                    className="px-4 py-2 bg-slate-800 text-xs text-slate-300 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleExecutePayment(activeModal as any)}
                    className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-lg shadow-sm"
                  >
                    Confirm & Record Payment
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
