import fs from 'fs';
import path from 'path';
import { randomUUID } from 'node:crypto';
import { eq, desc, and, sql } from 'drizzle-orm';
import { INITIAL_SERVICES } from './seed-data.ts';
import { toHundredths } from '../lib/calculator.ts';
import { getNeonDb, isNeonConfigured, ensureDatabaseConfigured, ensureNeonSchema, areNeonTablesAvailable } from './neon.ts';
import * as schema from './schema.ts';
import { ResearchResult, ResearchSource, ValueHistoryItem, ResearchScheduleConfig, ResearchStatus } from '../types/index.ts';

export interface ServiceRecord {
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
  createdAt: string;
  updatedAt: string;
}

export interface OrderRecord {
  id: string;
  publicToken: string;
  orderCode: string;
  serviceId: string;
  robloxUsername: string;
  timezone: string;
  availability: string;
  paymentType: 'fruits' | 'gamepass' | 'combination';
  status: 
    | 'pending_review' 
    | 'accepted' 
    | 'more_info_needed' 
    | 'deposit_received' 
    | 'in_progress' 
    | 'completed' 
    | 'fully_paid' 
    | 'rejected' 
    | 'cancelled';
  totalPriceHundredths: number;
  depositHundredths: number;
  remainingHundredths: number;
  customerNote?: string | null;
  staffNotes?: string | null;
  consentPublicProofs?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItemRecord {
  id: string;
  orderId: string;
  itemName: string;
  quantity: number;
  proposedValueHundredths: number;
  agreedValueHundredths?: number | null;
  verified: boolean;
}

export interface OrderItemInput {
  itemName: string;
  quantity: number;
  proposedValueHundredths: number;
  agreedValueHundredths?: number | null;
  verified?: boolean;
}

export interface OrderAuditRecord {
  id: string;
  orderId: string;
  actor: 'customer' | 'staff' | 'system';
  action: string;
  note?: string | null;
  createdAt: string;
}

export interface PaymentRecord {
  id: string;
  orderId: string;
  kind: 'deposit' | 'remaining';
  amountHundredths: number;
  itemsJson: string;
  recordedBy: string;
  recordedAt: string;
}

export interface EnquiryRecord {
  id: string;
  source: string; // 'website' | 'discord' | 'direct'
  customerName?: string | null;
  robloxUsername: string;
  discordTag?: string | null;
  orderCodeOrId?: string | null;
  subject: string;
  message: string;
  status: 'pending' | 'in_progress' | 'resolved';
  staffNotes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EvidenceRecord {
  id: string;
  orderId: string;
  serviceId: string;
  evidenceType: 'screenshot' | 'video_link' | 'screen_share_session';
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

interface DatabaseState {
  services: ServiceRecord[];
  orders: OrderRecord[];
  orderItems: OrderItemRecord[];
  orderAudit: OrderAuditRecord[];
  payments: PaymentRecord[];
  enquiries: EnquiryRecord[];
  evidence: EvidenceRecord[];
  researchResults: ResearchResult[];
  researchSources: ResearchSource[];
  valueHistory: ValueHistoryItem[];
  researchSchedule: ResearchScheduleConfig;
  counter: number;
}

// Helpers to map Drizzle query results to canonical Record types
function mapService(row: any): ServiceRecord {
  return {
    id: row.id,
    category: row.category,
    slug: row.slug,
    name: row.name,
    description: row.description,
    priceHundredths: Number(row.priceHundredths),
    priceM: typeof row.priceM === 'number' ? row.priceM.toFixed(2) : String(row.priceM),
    prerequisites: row.prerequisites || null,
    exclusions: row.exclusions || null,
    isPublished: Boolean(row.isPublished),
    needsConfirmation: Boolean(row.needsConfirmation),
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
  };
}

function mapOrder(row: any): OrderRecord {
  return {
    id: row.id,
    publicToken: row.publicToken,
    orderCode: row.orderCode,
    serviceId: row.serviceId,
    robloxUsername: row.robloxUsername,
    timezone: row.timezone,
    availability: row.availability,
    paymentType: row.paymentType as any,
    status: row.status as any,
    totalPriceHundredths: Number(row.totalPriceHundredths),
    depositHundredths: Number(row.depositHundredths),
    remainingHundredths: Number(row.remainingHundredths),
    customerNote: row.customerNote || null,
    staffNotes: row.staffNotes || null,
    consentPublicProofs: Boolean(row.consentPublicProofs),
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
  };
}

function mapOrderItem(row: any): OrderItemRecord {
  return {
    id: row.id,
    orderId: row.orderId,
    itemName: row.itemName,
    quantity: Number(row.quantity),
    proposedValueHundredths: Number(row.proposedValueHundredths),
    agreedValueHundredths: row.agreedValueHundredths !== null && row.agreedValueHundredths !== undefined
      ? Number(row.agreedValueHundredths)
      : null,
    verified: Boolean(row.verified),
  };
}

function mapAudit(row: any): OrderAuditRecord {
  return {
    id: row.id,
    orderId: row.orderId,
    actor: row.actor,
    action: row.action,
    note: row.note || null,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
  };
}

function mapPayment(row: any): PaymentRecord {
  return {
    id: row.id,
    orderId: row.orderId,
    kind: row.kind as any,
    amountHundredths: Number(row.amountHundredths),
    itemsJson: row.itemsJson,
    recordedBy: row.recordedBy,
    recordedAt: row.recordedAt instanceof Date ? row.recordedAt.toISOString() : String(row.recordedAt),
  };
}

function mapEnquiry(row: any): EnquiryRecord {
  return {
    id: row.id,
    source: row.source,
    customerName: row.customerName || null,
    robloxUsername: row.robloxUsername,
    discordTag: row.discordTag || null,
    orderCodeOrId: row.orderCodeOrId || null,
    subject: row.subject,
    message: row.message,
    status: row.status as any,
    staffNotes: row.staffNotes || null,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
  };
}

function mapEvidence(row: any): EvidenceRecord {
  return {
    id: row.id,
    orderId: row.orderId,
    serviceId: row.serviceId,
    evidenceType: row.evidenceType as any,
    mediaUrl: row.mediaUrl,
    notes: row.notes || null,
    customerConsentPublic: Boolean(row.customerConsentPublic),
    staffApprovedPublic: Boolean(row.staffApprovedPublic),
    isOngoing: Boolean(row.isOngoing),
    isCompleted: Boolean(row.isCompleted),
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    reviewedAt: row.reviewedAt ? (row.reviewedAt instanceof Date ? row.reviewedAt.toISOString() : String(row.reviewedAt)) : null,
    reviewedBy: row.reviewedBy || null,
  };
}

// ============================================================================
// Local Test & Development In-Memory Store
// strictly prohibited in production via ensureDatabaseConfigured()
// ============================================================================
const DATA_DIR = path.resolve(process.cwd(), '.data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadState(): DatabaseState {
  ensureDataDir();
  if (fs.existsSync(DATA_FILE)) {
    try {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.services)) {
        if (!Array.isArray(parsed.enquiries)) parsed.enquiries = [];
        if (!Array.isArray(parsed.evidence)) parsed.evidence = [];
        if (!Array.isArray(parsed.researchResults)) parsed.researchResults = [];
        if (!Array.isArray(parsed.researchSources)) parsed.researchSources = [];
        if (!Array.isArray(parsed.valueHistory)) parsed.valueHistory = [];
        if (!parsed.researchSchedule) {
          parsed.researchSchedule = {
            enabled: false,
            autoUpdateEnabled: true,
            minSources: 2,
            maxAllowedPercentChange: 25,
            intervalHours: 24,
            lastRunAt: null,
            nextRunAt: null,
            targetCategories: ['Fruits', 'Permanent Fruits', 'Gamepasses'],
          };
        } else {
          if (parsed.researchSchedule.autoUpdateEnabled === undefined) parsed.researchSchedule.autoUpdateEnabled = true;
          if (parsed.researchSchedule.minSources === undefined) parsed.researchSchedule.minSources = 2;
          if (parsed.researchSchedule.maxAllowedPercentChange === undefined) parsed.researchSchedule.maxAllowedPercentChange = 25;
          if (!parsed.researchSchedule.targetCategories.includes('Permanent Fruits')) {
            parsed.researchSchedule.targetCategories.push('Permanent Fruits');
          }
        }
        const initialMap = new Map(INITIAL_SERVICES.map(s => [s.id, s]));
        const existingIds = new Set(parsed.services.map((s: any) => s.id));
        let updated = false;

        // 1. Sync updated market values for existing fruits, permanent fruits, and gamepasses
        for (const existing of parsed.services) {
          const init = initialMap.get(existing.id);
          if (init && (init.category === 'Fruits' || init.category === 'Permanent Fruits' || init.category === 'Gamepasses')) {
            const newHundredths = toHundredths(init.priceM);
            if (existing.priceHundredths !== newHundredths || existing.name !== init.name || existing.description !== init.description) {
              existing.priceHundredths = newHundredths;
              existing.priceM = init.priceM.toFixed(2);
              existing.description = init.description;
              existing.name = init.name;
              existing.updatedAt = new Date().toISOString();
              updated = true;
            }
          }
        }

        // 2. Add any newly introduced items (e.g. +1 Fruit Storage, Fruit Notifier)
        for (const s of INITIAL_SERVICES) {
          if (!existingIds.has(s.id)) {
            parsed.services.push({
              id: s.id,
              category: s.category,
              slug: s.slug,
              name: s.name,
              description: s.description,
              priceHundredths: toHundredths(s.priceM),
              priceM: s.priceM.toFixed(2),
              prerequisites: s.prerequisites || null,
              exclusions: s.exclusions || null,
              isPublished: s.isPublished,
              needsConfirmation: s.needsConfirmation,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
            updated = true;
          }
        }
        if (updated) {
          saveState(parsed);
        }
        return parsed;
      }
    } catch (e) {
      console.error('Failed reading db.json, re-initializing', e);
    }
  }

  const seededServices: ServiceRecord[] = INITIAL_SERVICES.map((s) => ({
    id: s.id,
    category: s.category,
    slug: s.slug,
    name: s.name,
    description: s.description,
    priceHundredths: toHundredths(s.priceM),
    priceM: s.priceM.toFixed(2),
    prerequisites: s.prerequisites || null,
    exclusions: s.exclusions || null,
    isPublished: s.isPublished,
    needsConfirmation: s.needsConfirmation,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));

  const initial: DatabaseState = {
    services: seededServices,
    orders: [],
    orderItems: [],
    orderAudit: [],
    payments: [],
    enquiries: [],
    evidence: [],
    researchResults: [],
    researchSources: [],
    valueHistory: [],
    researchSchedule: {
      enabled: false,
      autoUpdateEnabled: true,
      minSources: 2,
      maxAllowedPercentChange: 25,
      intervalHours: 24,
      lastRunAt: null,
      nextRunAt: null,
      targetCategories: ['Fruits', 'Permanent Fruits', 'Gamepasses'],
    },
    counter: 1040,
  };

  saveState(initial);
  return initial;
}

function saveState(state: DatabaseState) {
  ensureDataDir();
  const tmpFile = `${DATA_FILE}.tmp.${Date.now()}`;
  fs.writeFileSync(tmpFile, JSON.stringify(state, null, 2), 'utf-8');
  fs.renameSync(tmpFile, DATA_FILE);
}

let stateCache: DatabaseState | null = null;
function getState(): DatabaseState {
  ensureDatabaseConfigured();
  if (!stateCache) {
    stateCache = loadState();
  }
  return stateCache;
}

function commitState() {
  if (stateCache) {
    saveState(stateCache);
  }
}

// Auto-seed services into Neon PostgreSQL if table is empty
let neonServicesSeeded = false;
let neonServicesSeedPromise: Promise<void> | null = null;

export async function ensureNeonServicesSeeded(db: NonNullable<ReturnType<typeof getNeonDb>>): Promise<void> {
  if (neonServicesSeeded) return;
  if (neonServicesSeedPromise) return neonServicesSeedPromise;

  neonServicesSeedPromise = (async () => {
    try {
      // 1. Ensure all Neon PostgreSQL tables and indexes exist before querying
      await ensureNeonSchema();

      // If tables are not available in the database (e.g. role lacks CREATE on public), skip queries
      if (!areNeonTablesAvailable()) {
        return;
      }

      // 2. Fetch existing service IDs to avoid duplicating or missing seed items
      const existing = await db.select({ id: schema.services.id }).from(schema.services);
      const existingIds = new Set(existing.map((s) => s.id));

      const missing = INITIAL_SERVICES.filter((s) => !existingIds.has(s.id));
      if (missing.length > 0) {
        const now = new Date();
        const values = missing.map((s) => ({
          id: s.id,
          category: s.category,
          slug: s.slug,
          name: s.name,
          description: s.description,
          priceHundredths: toHundredths(s.priceM),
          priceM: s.priceM.toFixed(2),
          prerequisites: s.prerequisites || null,
          exclusions: s.exclusions || null,
          isPublished: s.isPublished,
          needsConfirmation: s.needsConfirmation,
          createdAt: now,
          updatedAt: now,
        }));
        // Insert in batches of 20 for efficient network execution
        for (let i = 0; i < values.length; i += 20) {
          await db.insert(schema.services).values(values.slice(i, i + 20));
        }
      }

      // 3. Sync updated market values for existing fruits, permanent fruits, and gamepasses
      for (const s of INITIAL_SERVICES) {
        if (s.category === 'Fruits' || s.category === 'Permanent Fruits' || s.category === 'Gamepasses') {
          if (existingIds.has(s.id)) {
            await db
              .update(schema.services)
              .set({
                priceHundredths: toHundredths(s.priceM),
                priceM: s.priceM.toFixed(2),
                description: s.description,
                updatedAt: new Date(),
              })
              .where(eq(schema.services.id, s.id));
          }
        }
      }

      neonServicesSeeded = true;
    } catch (err: any) {
      neonServicesSeeded = false;
      const fullError = `${err?.message || ''} ${err?.cause?.message || ''} ${String(err || '')}`;
      if (fullError.includes('permission denied') || fullError.includes('does not exist')) {
        console.warn('Neon services seed skipped due to database permissions or missing table.');
        if (process.env.NODE_ENV !== 'production') {
          return;
        }
      }
      console.error('Error auto-seeding Neon services:', err);
      throw err;
    } finally {
      neonServicesSeedPromise = null;
    }
  })();

  return neonServicesSeedPromise;
}

// ============================================================================
// Core Database Repository
// Automatically routes all operations to Neon PostgreSQL when configured and ready.
// Fails safely in production if DATABASE_URL is missing.
// ============================================================================
export function isNeonActive(): boolean {
  return Boolean(getNeonDb()) && areNeonTablesAvailable();
}

export const dbRepository = {
  // Services
  async getServices(options?: { onlyPublished?: boolean; onlyUncertain?: boolean }): Promise<ServiceRecord[]> {
    ensureDatabaseConfigured();
    const db = getNeonDb();
    if (db) {
      await ensureNeonServicesSeeded(db);
    }
    if (isNeonActive() && db) {
      try {
        let rows = await db.select().from(schema.services);
        if (options?.onlyPublished) {
          rows = rows.filter(item => item.isPublished);
        }
        if (options?.onlyUncertain) {
          rows = rows.filter(item => item.needsConfirmation);
        }
        return rows.map(mapService);
      } catch (err: any) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Neon getServices error in dev, falling back to local catalogue:', err?.cause?.message || err?.message);
        } else {
          throw err;
        }
      }
    }

    const s = getState();
    let result = [...s.services];
    if (options?.onlyPublished) {
      result = result.filter(item => item.isPublished);
    }
    if (options?.onlyUncertain) {
      result = result.filter(item => item.needsConfirmation);
    }
    return result;
  },

  async getServiceById(id: string): Promise<ServiceRecord | undefined> {
    ensureDatabaseConfigured();
    const db = getNeonDb();
    if (db) {
      await ensureNeonServicesSeeded(db);
      if (areNeonTablesAvailable()) {
        try {
          const rows = await db.select().from(schema.services).where(eq(schema.services.id, id));
          return rows[0] ? mapService(rows[0]) : undefined;
        } catch (err: any) {
          if (process.env.NODE_ENV !== 'production') {
            console.warn('Neon getServiceById error in dev, falling back to local store:', err?.cause?.message || err?.message);
          } else {
            throw err;
          }
        }
      }
    }
    return getState().services.find(s => s.id === id);
  },

  async getServiceBySlug(slug: string): Promise<ServiceRecord | undefined> {
    ensureDatabaseConfigured();
    const db = getNeonDb();
    if (db) {
      await ensureNeonServicesSeeded(db);
      if (areNeonTablesAvailable()) {
        try {
          const rows = await db.select().from(schema.services).where(eq(schema.services.slug, slug));
          return rows[0] ? mapService(rows[0]) : undefined;
        } catch (err: any) {
          if (process.env.NODE_ENV !== 'production') {
            console.warn('Neon getServiceBySlug error in dev, falling back to local store:', err?.cause?.message || err?.message);
          } else {
            throw err;
          }
        }
      }
    }
    return getState().services.find(s => s.slug === slug);
  },

  async createService(data: Omit<ServiceRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<ServiceRecord> {
    ensureDatabaseConfigured();
    const db = getNeonDb();
    const id = `svc-${Date.now()}-${randomUUID().slice(0, 6)}`;
    const now = new Date();
    const nowIso = now.toISOString();

    if (isNeonActive() && db) {
      try {
        const row = {
          id,
          category: data.category,
          slug: data.slug,
          name: data.name,
          description: data.description,
          priceHundredths: data.priceHundredths,
          priceM: data.priceM,
          prerequisites: data.prerequisites || null,
          exclusions: data.exclusions || null,
          isPublished: Boolean(data.isPublished),
          needsConfirmation: Boolean(data.needsConfirmation),
          createdAt: now,
          updatedAt: now,
        };
        await db.insert(schema.services).values(row);
        return mapService({ ...row, createdAt: nowIso, updatedAt: nowIso });
      } catch (err: any) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Neon createService failed in dev, falling back to local store:', err?.cause?.message || err?.message);
        } else {
          throw err;
        }
      }
    }

    const s = getState();
    const newService: ServiceRecord = {
      ...data,
      id,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    s.services.push(newService);
    commitState();
    return newService;
  },

  async updateService(id: string, updates: Partial<Omit<ServiceRecord, 'id' | 'createdAt'>>): Promise<ServiceRecord | null> {
    ensureDatabaseConfigured();
    const db = getNeonDb();
    const now = new Date();

    if (isNeonActive() && db) {
      try {
        const updateData: any = { updatedAt: now };
        if (updates.category !== undefined) updateData.category = updates.category;
        if (updates.slug !== undefined) updateData.slug = updates.slug;
        if (updates.name !== undefined) updateData.name = updates.name;
        if (updates.description !== undefined) updateData.description = updates.description;
        if (updates.priceHundredths !== undefined) updateData.priceHundredths = updates.priceHundredths;
        if (updates.priceM !== undefined) updateData.priceM = updates.priceM;
        if (updates.prerequisites !== undefined) updateData.prerequisites = updates.prerequisites;
        if (updates.exclusions !== undefined) updateData.exclusions = updates.exclusions;
        if (updates.isPublished !== undefined) updateData.isPublished = updates.isPublished;
        if (updates.needsConfirmation !== undefined) updateData.needsConfirmation = updates.needsConfirmation;

        await db.update(schema.services).set(updateData).where(eq(schema.services.id, id));
        const [updated] = await db.select().from(schema.services).where(eq(schema.services.id, id));
        return updated ? mapService(updated) : null;
      } catch (err: any) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Neon updateService failed in dev, falling back to local store:', err?.cause?.message || err?.message);
        } else {
          throw err;
        }
      }
    }

    const s = getState();
    const index = s.services.findIndex(item => item.id === id);
    if (index === -1) return null;

    s.services[index] = {
      ...s.services[index],
      ...updates,
      updatedAt: now.toISOString(),
    };
    commitState();
    return s.services[index];
  },

  async deleteService(id: string): Promise<boolean> {
    ensureDatabaseConfigured();
    const db = getNeonDb();
    if (isNeonActive() && db) {
      try {
        const [existing] = await db.select().from(schema.services).where(eq(schema.services.id, id));
        if (!existing) return false;
        await db.delete(schema.services).where(eq(schema.services.id, id));
        return true;
      } catch (err: any) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Neon deleteService failed in dev, falling back to local store:', err?.cause?.message || err?.message);
        } else {
          throw err;
        }
      }
    }

    const s = getState();
    const lenBefore = s.services.length;
    s.services = s.services.filter(item => item.id !== id);
    if (s.services.length !== lenBefore) {
      commitState();
      return true;
    }
    return false;
  },

  // Orders
  async getNextOrderCode(): Promise<string> {
    ensureDatabaseConfigured();
    const db = getNeonDb();
    if (isNeonActive() && db) {
      try {
        const res = await db.select({ count: sql<number>`count(*)::int` }).from(schema.orders);
        const count = Number(res[0]?.count || 0) + 1;
        return `BFS-${1040 + count}`;
      } catch (err: any) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Neon getNextOrderCode failed in dev, falling back to local counter:', err?.cause?.message || err?.message);
        } else {
          throw err;
        }
      }
    }

    const s = getState();
    s.counter += 1;
    commitState();
    return `BFS-${s.counter}`;
  },

  async createOrder(
    order: Omit<OrderRecord, 'id' | 'createdAt' | 'updatedAt'>,
    items: OrderItemInput[]
  ): Promise<{ order: OrderRecord; items: OrderItemRecord[] }> {
    ensureDatabaseConfigured();
    const db = getNeonDb();
    const orderId = `ord-${Date.now()}-${randomUUID().slice(0, 7)}`;
    const now = new Date();
    const nowIso = now.toISOString();

    if (isNeonActive() && db) {
      try {
        const orderRow = {
          id: orderId,
          publicToken: order.publicToken,
          orderCode: order.orderCode,
          serviceId: order.serviceId,
          robloxUsername: order.robloxUsername,
          timezone: order.timezone,
          availability: order.availability,
          paymentType: order.paymentType,
          status: order.status || 'pending_review',
          totalPriceHundredths: order.totalPriceHundredths,
          depositHundredths: order.depositHundredths,
          remainingHundredths: order.remainingHundredths,
          customerNote: order.customerNote || null,
          staffNotes: order.staffNotes || null,
          consentPublicProofs: Boolean(order.consentPublicProofs),
          createdAt: now,
          updatedAt: now,
        };
        await db.insert(schema.orders).values(orderRow);

        const createdItems: OrderItemRecord[] = [];
        for (let idx = 0; idx < items.length; idx++) {
          const it = items[idx];
          const itemId = `item-${Date.now()}-${idx}-${randomUUID().slice(0, 5)}`;
          const itemRow = {
            id: itemId,
            orderId,
            itemName: it.itemName,
            quantity: it.quantity,
            proposedValueHundredths: it.proposedValueHundredths,
            agreedValueHundredths: it.agreedValueHundredths ?? null,
            verified: it.verified ?? false,
          };
          await db.insert(schema.orderItems).values(itemRow);
          createdItems.push(itemRow);
        }

        await db.insert(schema.orderAudit).values({
          id: `aud-${Date.now()}-${randomUUID().slice(0, 5)}`,
          orderId,
          actor: 'customer',
          action: 'ORDER_SUBMITTED',
          note: `Order submitted for ${order.paymentType} payment. Total: ${(order.totalPriceHundredths / 100).toFixed(2)}M.`,
          createdAt: now,
        });

        return {
          order: mapOrder({ ...orderRow, createdAt: nowIso, updatedAt: nowIso }),
          items: createdItems,
        };
      } catch (err: any) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Neon createOrder failed in dev, falling back to local store:', err?.cause?.message || err?.message);
        } else {
          throw err;
        }
      }
    }

    // In-memory test fallback
    const s = getState();
    const newOrder: OrderRecord = {
      ...order,
      consentPublicProofs: Boolean(order.consentPublicProofs),
      id: orderId,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const newItems: OrderItemRecord[] = items.map((it, idx) => ({
      ...it,
      id: `item-${Date.now()}-${idx}-${randomUUID().slice(0, 5)}`,
      orderId,
      verified: it.verified ?? false,
    }));

    s.orders.push(newOrder);
    s.orderItems.push(...newItems);

    s.orderAudit.push({
      id: `aud-${Date.now()}-${randomUUID().slice(0, 5)}`,
      orderId,
      actor: 'customer',
      action: 'ORDER_SUBMITTED',
      note: `Order submitted for ${order.paymentType} payment. Total: ${(order.totalPriceHundredths / 100).toFixed(2)}M.`,
      createdAt: nowIso,
    });

    commitState();
    return { order: newOrder, items: newItems };
  },

  async getOrderById(id: string): Promise<OrderRecord | undefined> {
    ensureDatabaseConfigured();
    const db = getNeonDb();
    if (isNeonActive() && db) {
      try {
        const rows = await db.select().from(schema.orders).where(eq(schema.orders.id, id));
        return rows[0] ? mapOrder(rows[0]) : undefined;
      } catch (err: any) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Neon getOrderById failed in dev, falling back to local store:', err?.cause?.message || err?.message);
        } else {
          throw err;
        }
      }
    }
    return getState().orders.find(o => o.id === id);
  },

  async getOrderByPublicToken(token: string): Promise<OrderRecord | undefined> {
    ensureDatabaseConfigured();
    const db = getNeonDb();
    if (isNeonActive() && db) {
      try {
        const rows = await db.select().from(schema.orders).where(eq(schema.orders.publicToken, token));
        return rows[0] ? mapOrder(rows[0]) : undefined;
      } catch (err: any) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Neon getOrderByPublicToken failed in dev, falling back to local store:', err?.cause?.message || err?.message);
        } else {
          throw err;
        }
      }
    }
    return getState().orders.find(o => o.publicToken === token);
  },

  async getOrderByCode(code: string): Promise<OrderRecord | undefined> {
    ensureDatabaseConfigured();
    const cleanCode = code.toUpperCase().trim();
    const db = getNeonDb();
    if (isNeonActive() && db) {
      try {
        const rows = await db.select().from(schema.orders).where(eq(schema.orders.orderCode, cleanCode));
        return rows[0] ? mapOrder(rows[0]) : undefined;
      } catch (err: any) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Neon getOrderByCode failed in dev, falling back to local store:', err?.cause?.message || err?.message);
        } else {
          throw err;
        }
      }
    }
    return getState().orders.find(o => o.orderCode.toUpperCase() === cleanCode);
  },

  async listOrders(filters?: { status?: string; search?: string }): Promise<OrderRecord[]> {
    ensureDatabaseConfigured();
    const db = getNeonDb();
    if (isNeonActive() && db) {
      try {
        let rows = await db.select().from(schema.orders).orderBy(desc(schema.orders.createdAt));
        if (filters?.status && filters.status !== 'all') {
          rows = rows.filter(o => o.status === filters.status);
        }
        if (filters?.search) {
          const q = filters.search.toLowerCase().trim();
          rows = rows.filter(o =>
            o.orderCode.toLowerCase().includes(q) ||
            o.robloxUsername.toLowerCase().includes(q)
          );
        }
        return rows.map(mapOrder);
      } catch (err: any) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Neon listOrders failed in dev, falling back to local store:', err?.cause?.message || err?.message);
        } else {
          throw err;
        }
      }
    }

    const s = getState();
    let result = [...s.orders];
    if (filters?.status && filters.status !== 'all') {
      result = result.filter(o => o.status === filters.status);
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase().trim();
      result = result.filter(o =>
        o.orderCode.toLowerCase().includes(q) ||
        o.robloxUsername.toLowerCase().includes(q)
      );
    }
    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return result;
  },

  async updateOrderStatus(
    orderId: string, 
    newStatus: OrderRecord['status'], 
    actor: 'staff' | 'system', 
    note?: string
  ): Promise<OrderRecord | null> {
    ensureDatabaseConfigured();
    const db = getNeonDb();
    const now = new Date();
    const nowIso = now.toISOString();

    if (isNeonActive() && db) {
      try {
        const [existing] = await db.select().from(schema.orders).where(eq(schema.orders.id, orderId));
        if (!existing) return null;
        const oldStatus = existing.status;

        await db.update(schema.orders)
          .set({ status: newStatus, updatedAt: now })
          .where(eq(schema.orders.id, orderId));

        await db.insert(schema.orderAudit).values({
          id: `aud-${Date.now()}-${randomUUID().slice(0, 5)}`,
          orderId,
          actor,
          action: `STATUS_CHANGE_${oldStatus.toUpperCase()}_TO_${newStatus.toUpperCase()}`,
          note: note || `Status changed to ${newStatus}`,
          createdAt: now,
        });

        const [updated] = await db.select().from(schema.orders).where(eq(schema.orders.id, orderId));
        return updated ? mapOrder(updated) : null;
      } catch (err: any) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Neon updateOrderStatus failed in dev, falling back to local store:', err?.cause?.message || err?.message);
        } else {
          throw err;
        }
      }
    }

    const s = getState();
    const order = s.orders.find(o => o.id === orderId);
    if (!order) return null;

    const oldStatus = order.status;
    order.status = newStatus;
    order.updatedAt = nowIso;

    s.orderAudit.push({
      id: `aud-${Date.now()}-${randomUUID().slice(0, 5)}`,
      orderId,
      actor,
      action: `STATUS_CHANGE_${oldStatus.toUpperCase()}_TO_${newStatus.toUpperCase()}`,
      note: note || `Status changed to ${newStatus}`,
      createdAt: nowIso,
    });

    commitState();
    return order;
  },

  async updateOrderStaffNotes(orderId: string, staffNotes: string): Promise<OrderRecord | null> {
    ensureDatabaseConfigured();
    const db = getNeonDb();
    const now = new Date();

    if (isNeonActive() && db) {
      try {
        await db.update(schema.orders)
          .set({ staffNotes, updatedAt: now })
          .where(eq(schema.orders.id, orderId));
        const [updated] = await db.select().from(schema.orders).where(eq(schema.orders.id, orderId));
        return updated ? mapOrder(updated) : null;
      } catch (err: any) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Neon updateOrderStaffNotes failed in dev, falling back to local store:', err?.cause?.message || err?.message);
        } else {
          throw err;
        }
      }
    }

    const s = getState();
    const order = s.orders.find(o => o.id === orderId);
    if (!order) return null;
    order.staffNotes = staffNotes;
    order.updatedAt = now.toISOString();
    commitState();
    return order;
  },

  // Order Items
  async getOrderItems(orderId: string): Promise<OrderItemRecord[]> {
    ensureDatabaseConfigured();
    const db = getNeonDb();
    if (isNeonActive() && db) {
      try {
        const rows = await db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, orderId));
        return rows.map(mapOrderItem);
      } catch (err: any) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Neon getOrderItems failed in dev, falling back to local store:', err?.cause?.message || err?.message);
        } else {
          throw err;
        }
      }
    }
    return getState().orderItems.filter(i => i.orderId === orderId);
  },

  async updateOrderItem(
    itemId: string, 
    updates: { agreedValueHundredths?: number | null; verified?: boolean }
  ): Promise<OrderItemRecord | null> {
    ensureDatabaseConfigured();
    const db = getNeonDb();
    if (isNeonActive() && db) {
      try {
        const updateData: any = {};
        if (updates.agreedValueHundredths !== undefined) {
          updateData.agreedValueHundredths = updates.agreedValueHundredths;
        }
        if (updates.verified !== undefined) {
          updateData.verified = updates.verified;
        }
        await db.update(schema.orderItems).set(updateData).where(eq(schema.orderItems.id, itemId));
        const [row] = await db.select().from(schema.orderItems).where(eq(schema.orderItems.id, itemId));
        return row ? mapOrderItem(row) : null;
      } catch (err: any) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Neon updateOrderItem failed in dev, falling back to local store:', err?.cause?.message || err?.message);
        } else {
          throw err;
        }
      }
    }

    const s = getState();
    const item = s.orderItems.find(i => i.id === itemId);
    if (!item) return null;

    if (updates.agreedValueHundredths !== undefined) {
      item.agreedValueHundredths = updates.agreedValueHundredths;
    }
    if (updates.verified !== undefined) {
      item.verified = updates.verified;
    }

    commitState();
    return item;
  },

  // Audit Logs
  async addAuditLog(orderId: string, actor: 'customer' | 'staff' | 'system', action: string, note?: string): Promise<OrderAuditRecord> {
    ensureDatabaseConfigured();
    const db = getNeonDb();
    const id = `aud-${Date.now()}-${randomUUID().slice(0, 5)}`;
    const now = new Date();
    const nowIso = now.toISOString();

    if (isNeonActive() && db) {
      try {
        const row = {
          id,
          orderId,
          actor,
          action,
          note: note || null,
          createdAt: now,
        };
        await db.insert(schema.orderAudit).values(row);
        return mapAudit({ ...row, createdAt: nowIso });
      } catch (err: any) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Neon addAuditLog failed in dev, falling back to local store:', err?.cause?.message || err?.message);
        } else {
          throw err;
        }
      }
    }

    const s = getState();
    const entry: OrderAuditRecord = {
      id,
      orderId,
      actor,
      action,
      note: note || null,
      createdAt: nowIso,
    };
    s.orderAudit.push(entry);
    commitState();
    return entry;
  },

  async getOrderAuditLogs(orderId: string): Promise<OrderAuditRecord[]> {
    ensureDatabaseConfigured();
    const db = getNeonDb();
    if (isNeonActive() && db) {
      try {
        const rows = await db.select().from(schema.orderAudit)
          .where(eq(schema.orderAudit.orderId, orderId))
          .orderBy(schema.orderAudit.createdAt);
        return rows.map(mapAudit);
      } catch (err: any) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Neon getOrderAuditLogs failed in dev, falling back to local store:', err?.cause?.message || err?.message);
        } else {
          throw err;
        }
      }
    }

    return getState().orderAudit
      .filter(a => a.orderId === orderId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  },

  // Payments
  async recordPayment(
    orderId: string, 
    kind: 'deposit' | 'remaining', 
    amountHundredths: number, 
    itemsJson: string, 
    recordedBy: string
  ): Promise<PaymentRecord> {
    ensureDatabaseConfigured();
    const db = getNeonDb();
    const id = `pay-${Date.now()}-${randomUUID().slice(0, 5)}`;
    const now = new Date();
    const nowIso = now.toISOString();

    if (isNeonActive() && db) {
      try {
        const row = {
          id,
          orderId,
          kind,
          amountHundredths,
          itemsJson,
          recordedBy,
          recordedAt: now,
        };
        await db.insert(schema.payments).values(row);

        await db.insert(schema.orderAudit).values({
          id: `aud-${Date.now()}-${randomUUID().slice(0, 5)}`,
          orderId,
          actor: 'staff',
          action: `PAYMENT_RECORDED_${kind.toUpperCase()}`,
          note: `Staff '${recordedBy}' recorded ${kind} payment of ${(amountHundredths / 100).toFixed(2)}M. Items: ${itemsJson}`,
          createdAt: now,
        });

        return mapPayment({ ...row, recordedAt: nowIso });
      } catch (err: any) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Neon recordPayment failed in dev, falling back to local store:', err?.cause?.message || err?.message);
        } else {
          throw err;
        }
      }
    }

    const s = getState();
    const payment: PaymentRecord = {
      id,
      orderId,
      kind,
      amountHundredths,
      itemsJson,
      recordedBy,
      recordedAt: nowIso,
    };
    s.payments.push(payment);

    s.orderAudit.push({
      id: `aud-${Date.now()}-${randomUUID().slice(0, 5)}`,
      orderId,
      actor: 'staff',
      action: `PAYMENT_RECORDED_${kind.toUpperCase()}`,
      note: `Staff '${recordedBy}' recorded ${kind} payment of ${(amountHundredths / 100).toFixed(2)}M. Items: ${itemsJson}`,
      createdAt: nowIso,
    });

    commitState();
    return payment;
  },

  async getOrderPayments(orderId: string): Promise<PaymentRecord[]> {
    ensureDatabaseConfigured();
    const db = getNeonDb();
    if (isNeonActive() && db) {
      try {
        const rows = await db.select().from(schema.payments)
          .where(eq(schema.payments.orderId, orderId))
          .orderBy(schema.payments.recordedAt);
        return rows.map(mapPayment);
      } catch (err: any) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Neon getOrderPayments failed in dev, falling back to local store:', err?.cause?.message || err?.message);
        } else {
          throw err;
        }
      }
    }
    return getState().payments.filter(p => p.orderId === orderId);
  },

  // Enquiries (Customer Service)
  async createEnquiry(data: Omit<EnquiryRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<EnquiryRecord> {
    ensureDatabaseConfigured();
    const db = getNeonDb();
    const id = `enq-${Date.now()}-${randomUUID().slice(0, 6)}`;
    const now = new Date();
    const nowIso = now.toISOString();

    if (isNeonActive() && db) {
      try {
        const row = {
          id,
          source: data.source || 'website',
          customerName: data.customerName || null,
          robloxUsername: data.robloxUsername,
          discordTag: data.discordTag || null,
          orderCodeOrId: data.orderCodeOrId || null,
          subject: data.subject,
          message: data.message,
          status: data.status || 'pending',
          staffNotes: data.staffNotes || null,
          createdAt: now,
          updatedAt: now,
        };
        await db.insert(schema.enquiries).values(row);
        return mapEnquiry({ ...row, createdAt: nowIso, updatedAt: nowIso });
      } catch (err: any) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Neon createEnquiry failed in dev, falling back to local store:', err?.cause?.message || err?.message);
        } else {
          throw err;
        }
      }
    }

    const s = getState();
    const newEnquiry: EnquiryRecord = {
      ...data,
      id,
      status: data.status || 'pending',
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    s.enquiries.push(newEnquiry);
    commitState();
    return newEnquiry;
  },

  async listEnquiries(filters?: { status?: string; search?: string }): Promise<EnquiryRecord[]> {
    ensureDatabaseConfigured();
    const db = getNeonDb();
    if (isNeonActive() && db) {
      try {
        let rows = await db.select().from(schema.enquiries).orderBy(desc(schema.enquiries.createdAt));
        if (filters?.status && filters.status !== 'all') {
          rows = rows.filter(e => e.status === filters.status);
        }
        if (filters?.search) {
          const q = filters.search.toLowerCase().trim();
          rows = rows.filter(e =>
            e.robloxUsername.toLowerCase().includes(q) ||
            (e.orderCodeOrId && e.orderCodeOrId.toLowerCase().includes(q)) ||
            (e.discordTag && e.discordTag.toLowerCase().includes(q)) ||
            e.subject.toLowerCase().includes(q)
          );
        }
        return rows.map(mapEnquiry);
      } catch (err: any) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Neon listEnquiries failed in dev, falling back to local store:', err?.cause?.message || err?.message);
        } else {
          throw err;
        }
      }
    }

    const s = getState();
    let result = [...s.enquiries];
    if (filters?.status && filters.status !== 'all') {
      result = result.filter(e => e.status === filters.status);
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase().trim();
      result = result.filter(e =>
        e.robloxUsername.toLowerCase().includes(q) ||
        (e.orderCodeOrId && e.orderCodeOrId.toLowerCase().includes(q)) ||
        (e.discordTag && e.discordTag.toLowerCase().includes(q)) ||
        e.subject.toLowerCase().includes(q)
      );
    }
    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return result;
  },

  async getEnquiryById(id: string): Promise<EnquiryRecord | undefined> {
    ensureDatabaseConfigured();
    const db = getNeonDb();
    if (isNeonActive() && db) {
      try {
        const rows = await db.select().from(schema.enquiries).where(eq(schema.enquiries.id, id));
        return rows[0] ? mapEnquiry(rows[0]) : undefined;
      } catch (err: any) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Neon getEnquiryById failed in dev, falling back to local store:', err?.cause?.message || err?.message);
        } else {
          throw err;
        }
      }
    }
    return getState().enquiries.find(e => e.id === id);
  },

  async updateEnquiryStatus(
    id: string,
    status: 'pending' | 'in_progress' | 'resolved',
    staffNotes?: string
  ): Promise<EnquiryRecord | null> {
    ensureDatabaseConfigured();
    const db = getNeonDb();
    const now = new Date();

    if (isNeonActive() && db) {
      try {
        const updateData: any = { status, updatedAt: now };
        if (staffNotes !== undefined) {
          updateData.staffNotes = staffNotes;
        }
        await db.update(schema.enquiries).set(updateData).where(eq(schema.enquiries.id, id));
        const [updated] = await db.select().from(schema.enquiries).where(eq(schema.enquiries.id, id));
        return updated ? mapEnquiry(updated) : null;
      } catch (err: any) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Neon updateEnquiryStatus failed in dev, falling back to local store:', err?.cause?.message || err?.message);
        } else {
          throw err;
        }
      }
    }

    const s = getState();
    const enquiry = s.enquiries.find(e => e.id === id);
    if (!enquiry) return null;

    enquiry.status = status;
    if (staffNotes !== undefined) {
      enquiry.staffNotes = staffNotes;
    }
    enquiry.updatedAt = now.toISOString();
    commitState();
    return enquiry;
  },

  // Service Evidence & Discord-Based Proofs
  async createEvidence(data: Omit<EvidenceRecord, 'id' | 'createdAt'>): Promise<EvidenceRecord> {
    ensureDatabaseConfigured();
    const db = getNeonDb();
    const id = `evi-${Date.now()}-${randomUUID().slice(0, 6)}`;
    const now = new Date();
    const nowIso = now.toISOString();

    if (isNeonActive() && db) {
      try {
        const row = {
          id,
          orderId: data.orderId,
          serviceId: data.serviceId,
          evidenceType: data.evidenceType,
          mediaUrl: data.mediaUrl,
          notes: data.notes || null,
          customerConsentPublic: Boolean(data.customerConsentPublic),
          staffApprovedPublic: Boolean(data.staffApprovedPublic),
          isOngoing: Boolean(data.isOngoing),
          isCompleted: data.isCompleted !== undefined ? Boolean(data.isCompleted) : true,
          createdAt: now,
          reviewedAt: data.reviewedAt ? new Date(data.reviewedAt) : null,
          reviewedBy: data.reviewedBy || null,
        };
        await db.insert(schema.serviceEvidence).values(row);
        return mapEvidence({ ...row, createdAt: nowIso, reviewedAt: data.reviewedAt || null });
      } catch (err: any) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Neon createEvidence failed in dev, falling back to local store:', err?.cause?.message || err?.message);
        } else {
          throw err;
        }
      }
    }

    const s = getState();
    const newEvidence: EvidenceRecord = {
      ...data,
      id,
      createdAt: nowIso,
    };
    s.evidence.push(newEvidence);
    commitState();
    return newEvidence;
  },

  async getEvidenceByOrderId(orderId: string): Promise<EvidenceRecord[]> {
    ensureDatabaseConfigured();
    const db = getNeonDb();
    if (isNeonActive() && db) {
      try {
        const rows = await db.select().from(schema.serviceEvidence)
          .where(eq(schema.serviceEvidence.orderId, orderId))
          .orderBy(desc(schema.serviceEvidence.createdAt));
        return rows.map(mapEvidence);
      } catch (err: any) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Neon getEvidenceByOrderId failed in dev, falling back to local store:', err?.cause?.message || err?.message);
        } else {
          throw err;
        }
      }
    }
    return getState().evidence.filter(e => e.orderId === orderId);
  },

  async listEvidence(filters?: { isCompleted?: boolean; staffApprovedPublic?: boolean }): Promise<EvidenceRecord[]> {
    ensureDatabaseConfigured();
    const db = getNeonDb();
    if (isNeonActive() && db) {
      try {
        let rows = await db.select().from(schema.serviceEvidence).orderBy(desc(schema.serviceEvidence.createdAt));
        if (filters?.isCompleted !== undefined) {
          rows = rows.filter(e => e.isCompleted === filters.isCompleted);
        }
        if (filters?.staffApprovedPublic !== undefined) {
          rows = rows.filter(e => e.staffApprovedPublic === filters.staffApprovedPublic);
        }
        return rows.map(mapEvidence);
      } catch (err: any) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Neon listEvidence failed in dev, falling back to local store:', err?.cause?.message || err?.message);
        } else {
          throw err;
        }
      }
    }

    const s = getState();
    let result = [...s.evidence];
    if (filters?.isCompleted !== undefined) {
      result = result.filter(e => e.isCompleted === filters.isCompleted);
    }
    if (filters?.staffApprovedPublic !== undefined) {
      result = result.filter(e => e.staffApprovedPublic === filters.staffApprovedPublic);
    }
    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return result;
  },

  async updateEvidenceApproval(
    id: string,
    staffApprovedPublic: boolean,
    reviewedBy: string
  ): Promise<EvidenceRecord | null> {
    ensureDatabaseConfigured();
    const db = getNeonDb();
    const now = new Date();

    if (isNeonActive() && db) {
      try {
        await db.update(schema.serviceEvidence)
          .set({
            staffApprovedPublic,
            reviewedAt: now,
            reviewedBy,
          })
          .where(eq(schema.serviceEvidence.id, id));
        const [updated] = await db.select().from(schema.serviceEvidence).where(eq(schema.serviceEvidence.id, id));
        return updated ? mapEvidence(updated) : null;
      } catch (err: any) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Neon updateEvidenceApproval failed in dev, falling back to local store:', err?.cause?.message || err?.message);
        } else {
          throw err;
        }
      }
    }

    const s = getState();
    const ev = s.evidence.find(e => e.id === id);
    if (!ev) return null;

    ev.staffApprovedPublic = staffApprovedPublic;
    ev.reviewedAt = now.toISOString();
    ev.reviewedBy = reviewedBy;
    commitState();
    return ev;
  },

  /**
   * Public Proofs:
   * STRICT REQUIREMENT: Only returns evidence where customerConsentPublic === true
   * AND staffApprovedPublic === true AND isCompleted === true.
   */
  async getPublicProofs() {
    ensureDatabaseConfigured();
    const db = getNeonDb();
    if (isNeonActive() && db) {
      try {
        const allEvidence = await db.select().from(schema.serviceEvidence)
          .where(
            and(
              eq(schema.serviceEvidence.customerConsentPublic, true),
              eq(schema.serviceEvidence.staffApprovedPublic, true),
              eq(schema.serviceEvidence.isCompleted, true)
            )
          );
        const allOrders = await db.select().from(schema.orders);
        const allServices = await db.select().from(schema.services);

        return allEvidence.map(ev => {
          const order = allOrders.find(o => o.id === ev.orderId);
          const service = allServices.find(svc => svc.id === ev.serviceId);
          const fullUsername = order ? order.robloxUsername : 'BloxPlayer';
          const usernameDisplay = ev.customerConsentPublic ? fullUsername : `${fullUsername.slice(0, 2)}***`;

          return {
            id: ev.id,
            orderId: ev.orderId,
            orderCode: order ? order.orderCode : 'BFS-XXXX',
            serviceId: ev.serviceId,
            serviceName: service ? service.name : 'Blox Fruit Service',
            serviceCategory: service ? service.category : 'Carries',
            robloxUsername: usernameDisplay,
            evidenceType: ev.evidenceType,
            mediaUrl: ev.mediaUrl,
            notes: ev.notes,
            customerConsentPublic: ev.customerConsentPublic,
            staffApprovedPublic: ev.staffApprovedPublic,
            createdAt: ev.createdAt instanceof Date ? ev.createdAt.toISOString() : String(ev.createdAt),
            reviewedAt: ev.reviewedAt ? (ev.reviewedAt instanceof Date ? ev.reviewedAt.toISOString() : String(ev.reviewedAt)) : null,
          };
        });
      } catch (err: any) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Neon getPublicProofs failed in dev, falling back to local store:', err?.cause?.message || err?.message);
        } else {
          throw err;
        }
      }
    }

    const s = getState();
    const approved = s.evidence.filter(
      e => e.customerConsentPublic === true && e.staffApprovedPublic === true && e.isCompleted === true
    );

    return approved.map(ev => {
      const order = s.orders.find(o => o.id === ev.orderId);
      const service = s.services.find(svc => svc.id === ev.serviceId);
      const fullUsername = order ? order.robloxUsername : 'BloxPlayer';
      const usernameDisplay = ev.customerConsentPublic ? fullUsername : `${fullUsername.slice(0, 2)}***`;

      return {
        id: ev.id,
        orderId: ev.orderId,
        orderCode: order ? order.orderCode : 'BFS-XXXX',
        serviceId: ev.serviceId,
        serviceName: service ? service.name : 'Blox Fruit Service',
        serviceCategory: service ? service.category : 'Carries',
        robloxUsername: usernameDisplay,
        evidenceType: ev.evidenceType,
        mediaUrl: ev.mediaUrl,
        notes: ev.notes,
        customerConsentPublic: ev.customerConsentPublic,
        staffApprovedPublic: ev.staffApprovedPublic,
        createdAt: ev.createdAt,
        reviewedAt: ev.reviewedAt,
      };
    });
  },

  /**
   * Ongoing Services (Active carries queue):
   * Transparent live view of orders currently accepted, deposit_received, or in_progress.
   * STRICT REQUIREMENT: Anonymizes / masks usernames UNLESS customer consented to public display.
   */
  async getOngoingCarries() {
    ensureDatabaseConfigured();
    const db = getNeonDb();
    if (isNeonActive() && db) {
      try {
        const allOrders = await db.select().from(schema.orders);
        const activeOrders = allOrders.filter(o => 
          ['accepted', 'deposit_received', 'in_progress'].includes(o.status)
        );
        const allServices = await db.select().from(schema.services);
        const allEvidence = await db.select().from(schema.serviceEvidence);

        return activeOrders.map(o => {
          const service = allServices.find(svc => svc.id === o.serviceId);
          const evidence = allEvidence.filter(e => e.orderId === o.id);
          const hasLiveScreenShare = evidence.some(e => e.evidenceType === 'screen_share_session');

          let usernameDisplay = 'Client_***';
          if (o.consentPublicProofs) {
            usernameDisplay = o.robloxUsername;
          } else if (o.robloxUsername.length > 3) {
            usernameDisplay = `${o.robloxUsername.slice(0, 2)}***${o.robloxUsername.slice(-1)}`;
          }

          return {
            orderCode: o.orderCode,
            serviceName: service ? service.name : 'Blox Fruit Carry',
            serviceCategory: service ? service.category : 'General',
            robloxUsernameDisplay: usernameDisplay,
            status: o.status,
            paymentType: o.paymentType,
            updatedAt: o.updatedAt instanceof Date ? o.updatedAt.toISOString() : String(o.updatedAt),
            hasLiveScreenShare,
          };
        });
      } catch (err: any) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Neon getOngoingCarries failed in dev, falling back to local store:', err?.cause?.message || err?.message);
        } else {
          throw err;
        }
      }
    }

    const s = getState();
    const activeOrders = s.orders.filter(o => 
      ['accepted', 'deposit_received', 'in_progress'].includes(o.status)
    );

    return activeOrders.map(o => {
      const service = s.services.find(svc => svc.id === o.serviceId);
      const evidence = s.evidence.filter(e => e.orderId === o.id);
      const hasLiveScreenShare = evidence.some(e => e.evidenceType === 'screen_share_session');

      let usernameDisplay = 'Client_***';
      if (o.consentPublicProofs) {
        usernameDisplay = o.robloxUsername;
      } else if (o.robloxUsername.length > 3) {
        usernameDisplay = `${o.robloxUsername.slice(0, 2)}***${o.robloxUsername.slice(-1)}`;
      }

      return {
        orderCode: o.orderCode,
        serviceName: service ? service.name : 'Blox Fruit Carry',
        serviceCategory: service ? service.category : 'General',
        robloxUsernameDisplay: usernameDisplay,
        status: o.status,
        paymentType: o.paymentType,
        updatedAt: o.updatedAt,
        hasLiveScreenShare,
      };
    });
  },

  // ============================================================================
  // VALUE RESEARCH & MARKET VERIFICATION REPOSITORY
  // ============================================================================

  async saveResearchResult(result: ResearchResult, sources: ResearchSource[] = []): Promise<ResearchResult> {
    ensureDatabaseConfigured();
    const db = getNeonDb();
    const now = new Date();

    if (isNeonActive() && db) {
      try {
        await db.insert(schema.researchResults).values({
          id: result.id,
          itemId: result.itemId || null,
          itemName: result.itemName,
          category: result.category,
          currentValueM: String(result.currentValueM),
          previousValueM: result.previousValueM ? String(result.previousValueM) : null,
          researchedValueM: String(result.researchedValueM),
          changePercent: result.changePercent !== null && result.changePercent !== undefined ? String(result.changePercent) : null,
          status: result.status,
          confidence: result.confidence,
          sourcesCount: result.sourcesCount,
          discrepancyNote: result.discrepancyNote || null,
          researchedAt: new Date(result.researchedAt),
          approvedAt: result.approvedAt ? new Date(result.approvedAt) : null,
          approvedBy: result.approvedBy || null,
          notes: result.notes || null,
        });

        for (const s of sources) {
          await db.insert(schema.researchSources).values({
            id: s.id,
            researchId: result.id,
            sourceName: s.sourceName,
            sourceUrl: s.sourceUrl,
            reportedValueM: String(s.reportedValueM),
            snippets: s.snippets || null,
            retrievedAt: new Date(s.retrievedAt),
          });
        }
      } catch (err: any) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Neon saveResearchResult failed in dev, falling back to local store:', err?.cause?.message || err?.message);
        } else {
          throw err;
        }
      }
    }

    const s = getState();
    // Replace if duplicate ID or append
    const existingIdx = s.researchResults.findIndex(r => r.id === result.id);
    const completeResult = { ...result, sources };
    if (existingIdx >= 0) {
      s.researchResults[existingIdx] = completeResult;
    } else {
      s.researchResults.unshift(completeResult);
    }

    for (const src of sources) {
      const srcIdx = s.researchSources.findIndex(x => x.id === src.id);
      if (srcIdx >= 0) {
        s.researchSources[srcIdx] = src;
      } else {
        s.researchSources.push(src);
      }
    }

    commitState();
    return completeResult;
  },

  async listResearchResults(filters?: { status?: string; category?: string; search?: string }): Promise<ResearchResult[]> {
    ensureDatabaseConfigured();
    const db = getNeonDb();

    if (isNeonActive() && db) {
      try {
        const rows = await db.select().from(schema.researchResults).orderBy(desc(schema.researchResults.researchedAt));
        const allSources = await db.select().from(schema.researchSources);

        let mapped = rows.map(r => {
          const itemSources = allSources
            .filter(s => s.researchId === r.id)
            .map(s => ({
              id: s.id,
              researchId: s.researchId,
              sourceName: s.sourceName,
              sourceUrl: s.sourceUrl,
              reportedValueM: String(s.reportedValueM),
              snippets: s.snippets || null,
              retrievedAt: s.retrievedAt instanceof Date ? s.retrievedAt.toISOString() : String(s.retrievedAt),
            }));

          return {
            id: r.id,
            itemId: r.itemId || null,
            itemName: r.itemName,
            category: r.category,
            currentValueM: String(r.currentValueM),
            previousValueM: r.previousValueM ? String(r.previousValueM) : null,
            researchedValueM: String(r.researchedValueM),
            changePercent: r.changePercent !== null && r.changePercent !== undefined ? Number(r.changePercent) : null,
            status: r.status as any,
            confidence: r.confidence as any,
            sourcesCount: Number(r.sourcesCount),
            discrepancyNote: r.discrepancyNote || null,
            researchedAt: r.researchedAt instanceof Date ? r.researchedAt.toISOString() : String(r.researchedAt),
            approvedAt: r.approvedAt ? (r.approvedAt instanceof Date ? r.approvedAt.toISOString() : String(r.approvedAt)) : null,
            approvedBy: r.approvedBy || null,
            notes: r.notes || null,
            sources: itemSources,
          };
        });

        if (filters?.status && filters.status !== 'all') {
          mapped = mapped.filter(r => r.status === filters.status);
        }
        if (filters?.category && filters.category !== 'all') {
          mapped = mapped.filter(r => r.category.toLowerCase() === filters.category!.toLowerCase());
        }
        if (filters?.search) {
          const q = filters.search.toLowerCase().trim();
          mapped = mapped.filter(r => r.itemName.toLowerCase().includes(q) || r.category.toLowerCase().includes(q));
        }

        return mapped;
      } catch (err: any) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Neon listResearchResults failed in dev, falling back to local store:', err?.cause?.message || err?.message);
        } else {
          throw err;
        }
      }
    }

    const s = getState();
    let result = (s.researchResults || []).map(r => {
      const sources = (s.researchSources || []).filter(src => src.researchId === r.id);
      return { ...r, sources };
    });

    if (filters?.status && filters.status !== 'all') {
      result = result.filter(r => r.status === filters.status);
    }
    if (filters?.category && filters.category !== 'all') {
      result = result.filter(r => r.category.toLowerCase() === filters.category!.toLowerCase());
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase().trim();
      result = result.filter(r => r.itemName.toLowerCase().includes(q) || r.category.toLowerCase().includes(q));
    }

    result.sort((a, b) => new Date(b.researchedAt).getTime() - new Date(a.researchedAt).getTime());
    return result;
  },

  async getResearchResultById(id: string): Promise<ResearchResult | undefined> {
    const list = await this.listResearchResults();
    return list.find(r => r.id === id);
  },

  async approveResearchResult(
    id: string,
    approvedBy: string,
    overrideValueM?: string,
    statusOverride?: ResearchStatus,
    changeReason?: string
  ): Promise<{ success: boolean; service?: ServiceRecord; research: ResearchResult }> {
    ensureDatabaseConfigured();
    const db = getNeonDb();
    const now = new Date();
    const nowIso = now.toISOString();

    const currentResearch = await this.getResearchResultById(id);
    if (!currentResearch) {
      throw new Error(`Research result ${id} not found`);
    }

    const finalValM = (overrideValueM && !isNaN(parseFloat(overrideValueM))) 
      ? parseFloat(overrideValueM).toFixed(2) 
      : currentResearch.researchedValueM;

    const finalHundredths = toHundredths(parseFloat(finalValM));
    const finalStatus: ResearchStatus = statusOverride || 'approved';
    const finalReason = changeReason || (approvedBy.toLowerCase().includes('auto') ? 'auto_verified_update' : 'admin_approved_research');

    let updatedService: ServiceRecord | undefined;

    // 1. If linked to an existing catalogue item or matches by name, update official catalogue price
    const allServices = await this.getServices();
    const targetService = allServices.find(s => 
      (currentResearch.itemId && s.id === currentResearch.itemId) || 
      s.name.toLowerCase() === currentResearch.itemName.toLowerCase()
    );

    if (targetService) {
      const oldPriceM = targetService.priceM;
      updatedService = await this.updateService(targetService.id, {
        priceM: finalValM,
        priceHundredths: finalHundredths,
        isPublished: true,
        needsConfirmation: false,
      }) || undefined;

      // Record in value_history table
      const histId = `hist-${Date.now()}-${randomUUID().slice(0, 6)}`;
      const historyItem: ValueHistoryItem = {
        id: histId,
        itemId: targetService.id,
        itemName: targetService.name,
        oldValueM: oldPriceM,
        newValueM: finalValM,
        changeReason: finalReason,
        sourceResearchId: id,
        updatedBy: approvedBy,
        timestamp: nowIso,
      };

      if (isNeonActive() && db) {
        try {
          await db.insert(schema.valueHistory).values({
            id: histId,
            itemId: targetService.id,
            itemName: targetService.name,
            oldValueM: oldPriceM,
            newValueM: finalValM,
            changeReason: finalReason,
            sourceResearchId: id,
            updatedBy: approvedBy,
            timestamp: now,
          });
        } catch (err: any) {
          if (process.env.NODE_ENV !== 'production') {
            console.warn('Neon insert valueHistory failed in dev, falling back to local store:', err?.cause?.message || err?.message);
          } else {
            throw err;
          }
        }
      }

      const s = getState();
      if (!Array.isArray(s.valueHistory)) s.valueHistory = [];
      s.valueHistory.unshift(historyItem);
      commitState();
    }

    // 2. Mark research result as approved / automatically_updated
    if (isNeonActive() && db) {
      try {
        await db.update(schema.researchResults)
          .set({
            researchedValueM: finalValM,
            status: finalStatus,
            approvedAt: now,
            approvedBy,
          })
          .where(eq(schema.researchResults.id, id));
      } catch (err: any) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Neon approveResearchResult failed in dev:', err?.cause?.message || err?.message);
        } else {
          throw err;
        }
      }
    }

    const s = getState();
    const resItem = s.researchResults.find(r => r.id === id);
    if (resItem) {
      resItem.researchedValueM = finalValM;
      resItem.status = finalStatus;
      resItem.approvedAt = nowIso;
      resItem.approvedBy = approvedBy;
      commitState();
    }

    const updatedResearch = (await this.getResearchResultById(id)) || currentResearch;

    return {
      success: true,
      service: updatedService,
      research: updatedResearch,
    };
  },

  async rejectResearchResult(id: string, approvedBy: string, reason?: string): Promise<ResearchResult | null> {
    ensureDatabaseConfigured();
    const db = getNeonDb();
    const now = new Date();
    const nowIso = now.toISOString();

    if (isNeonActive() && db) {
      try {
        await db.update(schema.researchResults)
          .set({
            status: 'rejected',
            approvedAt: now,
            approvedBy,
            notes: reason ? `Rejected by ${approvedBy}: ${reason}` : `Rejected by ${approvedBy}`,
          })
          .where(eq(schema.researchResults.id, id));
      } catch (err: any) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Neon rejectResearchResult failed in dev:', err?.cause?.message || err?.message);
        } else {
          throw err;
        }
      }
    }

    const s = getState();
    const resItem = s.researchResults.find(r => r.id === id);
    if (!resItem) return null;

    resItem.status = 'rejected';
    resItem.approvedAt = nowIso;
    resItem.approvedBy = approvedBy;
    if (reason) {
      resItem.notes = `Rejected by ${approvedBy}: ${reason}`;
    }
    commitState();
    return resItem;
  },

  async editResearchResult(id: string, updatedValueM: string, notes?: string): Promise<ResearchResult | null> {
    ensureDatabaseConfigured();
    const db = getNeonDb();
    const valNum = parseFloat(updatedValueM);
    if (isNaN(valNum)) throw new Error('Invalid trading value number');
    const formattedValM = valNum.toFixed(2);

    const s = getState();
    const resItem = s.researchResults.find(r => r.id === id);
    if (!resItem) return null;

    const currentValM = parseFloat(resItem.currentValueM) || 0;
    let changePercent: number | null = null;
    if (currentValM > 0) {
      changePercent = Math.round(((valNum - currentValM) / currentValM) * 10000) / 100;
    }

    if (isNeonActive() && db) {
      try {
        await db.update(schema.researchResults)
          .set({
            researchedValueM: formattedValM,
            changePercent: changePercent !== null ? String(changePercent) : null,
            status: 'pending_approval',
            notes: notes || resItem.notes,
          })
          .where(eq(schema.researchResults.id, id));
      } catch (err: any) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Neon editResearchResult failed in dev:', err?.cause?.message || err?.message);
        } else {
          throw err;
        }
      }
    }

    resItem.researchedValueM = formattedValM;
    resItem.changePercent = changePercent;
    resItem.status = 'pending_approval';
    if (notes) resItem.notes = notes;
    commitState();

    return resItem;
  },

  async listValueHistory(itemId?: string): Promise<ValueHistoryItem[]> {
    ensureDatabaseConfigured();
    const db = getNeonDb();

    if (isNeonActive() && db) {
      try {
        let query = db.select().from(schema.valueHistory).orderBy(desc(schema.valueHistory.timestamp));
        const rows = await query;
        let mapped = rows.map(r => ({
          id: r.id,
          itemId: r.itemId,
          itemName: r.itemName,
          oldValueM: String(r.oldValueM),
          newValueM: String(r.newValueM),
          changeReason: r.changeReason,
          sourceResearchId: r.sourceResearchId || null,
          updatedBy: r.updatedBy,
          timestamp: r.timestamp instanceof Date ? r.timestamp.toISOString() : String(r.timestamp),
        }));
        if (itemId) {
          mapped = mapped.filter(h => h.itemId === itemId);
        }
        return mapped;
      } catch (err: any) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Neon listValueHistory failed in dev, falling back to local store:', err?.cause?.message || err?.message);
        } else {
          throw err;
        }
      }
    }

    const s = getState();
    let history = [...(s.valueHistory || [])];
    if (itemId) {
      history = history.filter(h => h.itemId === itemId);
    }
    history.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return history;
  },

  async getResearchScheduleConfig(): Promise<ResearchScheduleConfig> {
    const s = getState();
    if (!s.researchSchedule) {
      s.researchSchedule = {
        enabled: false,
        autoUpdateEnabled: true,
        minSources: 2,
        maxAllowedPercentChange: 25,
        intervalHours: 24,
        lastRunAt: null,
        nextRunAt: null,
        targetCategories: ['Fruits', 'Permanent Fruits', 'Gamepasses'],
      };
      commitState();
    } else {
      let modified = false;
      if (s.researchSchedule.autoUpdateEnabled === undefined) {
        s.researchSchedule.autoUpdateEnabled = true;
        modified = true;
      }
      if (s.researchSchedule.minSources === undefined) {
        s.researchSchedule.minSources = 2;
        modified = true;
      }
      if (s.researchSchedule.maxAllowedPercentChange === undefined) {
        s.researchSchedule.maxAllowedPercentChange = 25;
        modified = true;
      }
      if (!s.researchSchedule.targetCategories.includes('Permanent Fruits')) {
        s.researchSchedule.targetCategories.push('Permanent Fruits');
        modified = true;
      }
      if (modified) {
        commitState();
      }
    }
    return s.researchSchedule;
  },

  async updateResearchScheduleConfig(config: Partial<ResearchScheduleConfig>): Promise<ResearchScheduleConfig> {
    const s = getState();
    s.researchSchedule = {
      ...s.researchSchedule,
      ...config,
    };
    commitState();
    return s.researchSchedule;
  },

  // Helper to reset for test suite
  _resetForTesting() {
    stateCache = null;
    ensureDataDir();
    if (fs.existsSync(DATA_FILE)) {
      fs.unlinkSync(DATA_FILE);
    }
    return loadState();
  }
};
