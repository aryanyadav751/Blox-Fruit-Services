export interface Service {
  id: string;
  category: string;
  slug: string;
  name: string;
  description: string;
  priceHundredths: number;
  priceM: string;
  prerequisites?: string | null;
  exclusions?: string | null;
  isPublished: boolean;
  needsConfirmation: boolean;
  parentFruitId?: string | null;
  isMutation?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FruitMutation {
  id: string;
  name: string;
  parentFruitId: string;
  parentFruitName: string;
  physicalValueM: string;
  permanentValueM?: string | null;
  status: ResearchStatus;
  sourcesCount: number;
  sources?: ResearchSource[];
  discrepancyNote?: string | null;
  updatedAt: string;
}

export interface ProposedItem {
  itemName: string;
  quantity: number;
  proposedValueM: number | string;
}

export interface OrderItem {
  itemName: string;
  quantity: number;
  proposedValueM: string;
  agreedValueM?: string | null;
  verified: boolean;
}

export interface OrderPayment {
  kind: 'deposit' | 'remaining';
  amountM: string;
  recordedAt: string;
}

export interface OrderTimelineEvent {
  action: string;
  note?: string | null;
  createdAt: string;
  actor: string;
}

export type OrderStatus = 
  | 'pending_review' 
  | 'accepted' 
  | 'more_info_needed' 
  | 'deposit_received' 
  | 'in_progress' 
  | 'completed' 
  | 'fully_paid' 
  | 'rejected' 
  | 'cancelled';

export interface PublicOrder {
  orderCode: string;
  publicToken: string;
  serviceName: string;
  serviceCategory: string;
  robloxUsername: string;
  timezone: string;
  availability: string;
  paymentType: 'fruits' | 'gamepass' | 'combination';
  status: OrderStatus;
  totalPriceM: string;
  depositM: string;
  remainingM: string;
  customerNote?: string | null;
  consentPublicProofs?: boolean;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  payments: OrderPayment[];
  timeline: OrderTimelineEvent[];
}

export type EnquiryStatus = 'pending' | 'in_progress' | 'resolved';
export type EnquirySource = 'website' | 'discord' | 'direct';

export interface Enquiry {
  id: string;
  source: EnquirySource;
  customerName?: string | null;
  robloxUsername: string;
  discordTag?: string | null;
  orderCodeOrId?: string | null;
  subject: string;
  message: string;
  status: EnquiryStatus;
  staffNotes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CreateEnquiryPayload = Omit<Enquiry, 'id' | 'createdAt' | 'updatedAt' | 'staffNotes'> & {
  staffNotes?: string | null;
};

export type EvidenceType = 'screenshot' | 'video_link' | 'screen_share_session';

export interface ServiceEvidence {
  id: string;
  orderId: string;
  orderCode?: string;
  serviceId: string;
  serviceName?: string;
  serviceCategory?: string;
  robloxUsername?: string;
  robloxUsernameMasked?: string;
  evidenceType: EvidenceType;
  mediaUrl: string;
  notes?: string | null;
  customerConsentPublic: boolean;
  staffApprovedPublic: boolean;
  isOngoing: boolean;
  isCompleted: boolean;
  createdAt: string;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
}

export interface OngoingServiceItem {
  orderCode: string;
  serviceName: string;
  serviceCategory: string;
  robloxUsernameDisplay: string;
  status: OrderStatus;
  paymentType: string;
  updatedAt: string;
  hasLiveScreenShare?: boolean;
}

export type ResearchConfidence = 'high' | 'medium' | 'low' | 'conflict' | 'not_found';
export type ResearchStatus = 
  | 'automatically_updated'
  | 'pending_verification'
  | 'needs_review'
  | 'failed'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'conflict';

export interface ResearchSource {
  id: string;
  researchId: string;
  sourceName: string;
  sourceUrl: string;
  reportedValueM: string;
  snippets?: string | null;
  retrievedAt: string;
}

export interface ResearchResult {
  id: string;
  itemId?: string | null;
  itemName: string;
  category: string;
  parentFruitId?: string | null;
  parentFruitName?: string | null;
  isMutation?: boolean;
  currentValueM: string;
  previousValueM?: string | null;
  researchedValueM: string;
  changePercent?: number | null;
  status: ResearchStatus;
  confidence: ResearchConfidence;
  sourcesCount: number;
  discrepancyNote?: string | null;
  researchedAt: string;
  approvedAt?: string | null;
  approvedBy?: string | null;
  notes?: string | null;
  sources?: ResearchSource[];
}

export interface ValueHistoryItem {
  id: string;
  itemId: string;
  itemName: string;
  oldValueM: string;
  newValueM: string;
  changeReason: string;
  sourceResearchId?: string | null;
  updatedBy: string;
  timestamp: string;
}

export interface ResearchScheduleConfig {
  enabled: boolean;
  autoUpdateEnabled: boolean;
  minSources: number;
  maxAllowedPercentChange: number;
  intervalHours: number;
  lastRunAt?: string | null;
  nextRunAt?: string | null;
  targetCategories: string[];
}

export interface MarketTrendFruit {
  name: string;
  category: string;
  currentValueM: string;
  baselineValueM: string;
  changePercent: number;
  volatility: 'extreme' | 'high' | 'moderate';
  trendDirection: 'surging' | 'rising' | 'fluctuating' | 'cooling';
  demandTier: 'Apex' | 'High' | 'Solid';
  marketReason: string;
  sourcesCount: number;
  lastUpdated: string;
}
