export type ProductCategory =
  | 'LVP'
  | 'SPC'
  | 'Hardwood'
  | 'Engineered Hardwood'
  | 'Laminate'
  | 'Carpet'
  | 'Tile'
  | 'Cork'
  | 'Bamboo'
  | 'Area Rug'
  | 'Other';

export type CustomerType = 'Contractor' | 'Architect' | 'Designer' | 'Dealer' | 'Homeowner';
export type ProjectStatus = 'Lead' | 'Active' | 'Quoted' | 'Won' | 'Lost';
export type SampleOrderStatus = 'Pending' | 'Processing' | 'Shipped' | 'Delivered';

export interface PrivateLabel {
  brand: string;
  productName: string;
  sku: string;
  listPrice?: number;
  netPrice?: number;
}

export interface Product {
  id: string;
  trinityName: string;
  trinitySku: string;
  category: ProductCategory;
  subcategory?: string;
  description: string;
  specs: Record<string, string>;
  privateLabels: PrivateLabel[];
  tags: string[];
  brochureIds: string[];
  listPrice: number;
  netPrice: number;
  unit: 'sq ft' | 'sq yd' | 'carton' | 'each';
  sqftPerCarton?: number;
  status: 'active' | 'discontinued' | 'limited';
}

export interface Brochure {
  id: string;
  name: string;
  brand: string;
  category: string;
  fileName: string;
  fileSize?: number;
  uploadDate: string;
  tags: string[];
  description?: string;
  productIds: string[];
  pageCount?: number;
  hasFile?: boolean;
}

export interface Catalog {
  id: string;
  name: string;
  version: string;
  description?: string;
  brochureIds: string[];
  createdDate: string;
  modifiedDate: string;
  targetAudience: 'Architect' | 'Designer' | 'Contractor' | 'General';
  isTemplate: boolean;
  parentCatalogId?: string;
  tags: string[];
  customerId?: string;
}

// Multiple contacts per customer
export interface CustomerContact {
  id: string;
  name: string;
  title?: string;
  email: string;
  phone: string;
  isPrimary: boolean;
}

// Multiple ship-to addresses per customer
export interface ShipToAddress {
  id: string;
  label: string;     // e.g. "Main Office", "Warehouse", "Job Site 1"
  address: string;
  city: string;
  state: string;
  zip: string;
  isDefault: boolean;
}

export interface Customer {
  id: string;
  name: string;          // primary contact name (legacy/display)
  company: string;
  type: CustomerType;
  email: string;         // primary email (legacy/display)
  phone: string;         // primary phone (legacy/display)
  // Billing address
  billingAddress: string;
  billingCity: string;
  billingState: string;
  billingZip: string;
  // Multiple contacts
  contacts: CustomerContact[];
  // Multiple ship-to addresses
  shipToAddresses: ShipToAddress[];
  notes?: string;
  createdDate: string;
}

export interface ProjectNote {
  id: string;
  date: string;
  text: string;
  author: string;
}

export interface Project {
  id: string;
  customerId: string;
  name: string;
  description: string;
  address?: string;
  status: ProjectStatus;
  value: number;
  productIds: string[];
  notes: ProjectNote[];
  sampleOrderIds: string[];
  createdDate: string;
  anticipatedOrderDate?: string;
  closingDate?: string;
}

export interface SampleOrderItem {
  productId: string;
  productName: string;
  privateLabelName?: string;
  quantity: number;
  notes?: string;
}

export interface SampleOrder {
  id: string;
  customerId: string;
  projectId: string;
  items: SampleOrderItem[];
  status: SampleOrderStatus;
  orderedDate: string;
  shippingName: string;
  shippingAddress: string;
  shippingCity: string;
  shippingState: string;
  shippingZip: string;
  notes?: string;
  trackingNumber?: string;
}

export interface EmailMessage {
  id: string;
  from: string;
  fromName: string;
  to: string[];
  subject: string;
  body: string;
  date: string;
  isRead: boolean;
  isStarred: boolean;
  folder: 'inbox' | 'sent' | 'drafts' | 'trash';
  attachedBrochureIds: string[];
}

export interface PriceEntry {
  id: string;
  productId: string;
  trinityName: string;
  trinitySku: string;
  privateLabelBrand: string;
  privateLabelName: string;
  privateLabelSku: string;
  listPrice: number;
  netPrice: number;
  unit: string;
  effectiveDate: string;
  notes?: string;
}

export interface DistributorPriceEntry {
  id: string;
  productName: string;
  sku: string;
  category: string;
  listPrice: number;
  dealerPrice: number;
  unit: string;
}

export interface DistributorPriceList {
  id: string;
  distributorName: string;
  uploadDate: string;
  effectiveDate: string;
  entries: DistributorPriceEntry[];
}
