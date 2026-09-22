/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type OrderStatus = string;

export interface Client {
  id: string;
  name: string;
  contactName: string;
  email: string;
  ccEmails?: string;
  bdmId?: string | null;
  bdm?: { id: string; displayName: string; email: string } | null;
  bdms?: Array<{ id: string; displayName: string; email: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface OrderProduct {
  category?: 'device_management' | 'tech_product' | 'sales' | 'training';
  name: string;
  unitCost: number;
  quantity: number;
  lineTotal: number; // Automatically calculated
}

export interface Order {
  id: string;
  firestoreId?: string;
  createdBy?: string;
  creator?: { displayName: string };
  clientName: string;
  clientId?: string;
  client?: Client;
  licenseType?: string; // Legacy
  licenseCount?: number; // Legacy
  products?: OrderProduct[];
  status: OrderStatus;
  category: 'device_management' | 'tech_product' | 'sales' | 'training';
  createdAt: string;
  updatedAt: string;
  assignedTo?: string;
  assignedEmail?: string;
  notes?: string;
  audits?: any[];
  quoteAmount?: number;
  supplierQuoteNumber?: string;
  proformaInvoiceLink?: string;     // Pro Forma Invoice
  proformaInvoiceText?: string;
  taxInvoiceLink?: string;          // Tax Invoice
  taxInvoiceText?: string;
  onsitePurchaseOrderLink?: string;  // Onsite PO
  onsitePurchaseOrderText?: string;
  onsiteQuoteLink?: string;          // Onsite Quote
  onsiteQuoteText?: string;
  customerQuoteLink?: string;        // Customer Quote
  customerQuoteText?: string;
  customerPopLink?: string;          // Customer Proof of Payment
  onsiteTaxInvoiceLink?: string;     // Onsite Tax Invoice
  technicalQuoteLink?: string;       // Technical Quote
  technicalQuoteText?: string;
  salesQuoteLink?: string;           // Sales Quote
  salesQuoteText?: string;
  bdmId?: string;
  bdm?: { email: string; displayName: string };
  assignees?: Array<{ id: string; displayName: string; email: string; role: string }>;
  customAttachments?: Array<{ label: string; file: string }>;
  assigneeIds?: string[];
  slaViolation?: boolean;
  advanceBlocked?: boolean;
  missingRequiredDocs?: string[];
}



export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  role: 'admin' | 'user' | 'ops' | 'viewer' | 'bdm';
  createdAt: string;
  lastLogin: string;
}

export type BudgetQuoteStatus = 'draft' | 'pending_approval' | 'approved' | 'queried' | 'sent' | 'accepted' | 'declined' | 'converted';

export interface BudgetQuote {
  id: string;
  quoteNumber: string;
  clientId: string;
  client?: Client;
  clientName: string;
  title?: string | null;
  products: OrderProduct[];
  quoteAmount: number;
  notes?: string | null;
  message?: string | null;
  signature?: string | null;
  adminNotes?: string | null;
  status: BudgetQuoteStatus;
  technicalQuoteLink?: string | null;
  salesQuoteLink?: string | null;
  proformaInvoiceLink?: string | null;
  onsiteQuoteLink?: string | null;
  customerQuoteLink?: string | null;
  bdmId?: string | null;
  bdm?: { id: string; displayName: string; email: string } | null;
  convertedOrderId?: string | null;
  expiresAt?: string | null;
  createdBy: string;
  creator?: { displayName: string };
  assignees?: Array<{ id: string; displayName: string; email: string; role: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface Proposal {
  id: string;
  title: string;
  clientId: string;
  client?: Client;
  bdmId: string;
  bdm?: { id: string; displayName: string; email: string };
  status: 'draft' | 'pending_approval' | 'approved' | 'sent' | 'queried' | 'rejected' | 'declined';
  message?: string;
  signature?: string;
  products?: OrderProduct[];
  selectedDocuments?: string;
  attachments?: string[];
  technicalQuoteLink?: string | null;
  salesQuoteLink?: string | null;
  proformaInvoiceLink?: string | null;
  taxInvoiceLink?: string | null;
  onsiteQuoteLink?: string | null;
  customerQuoteLink?: string | null;
  customerPopLink?: string | null;
  onsitePurchaseOrderLink?: string | null;
  onsiteTaxInvoiceLink?: string | null;
  expiresAt?: string;
  adminNotes?: string;
  approvedById?: string;
  approvedBy?: { displayName: string };
  assignees?: Array<{ id: string; displayName: string; email: string; role: string }>;
  sentAt?: string;
  createdAt: string;
  updatedAt: string;
}
