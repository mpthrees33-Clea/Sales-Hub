import type {
  Customer, Product, Brochure, Catalog,
  Project, SampleOrder, EmailMessage,
  PriceEntry, DistributorPriceList,
  Rep, SalesLocation, EmailThread, EmailDraft,
  Quote, Activity, GcSubEdge, DormantDigest,
  ProjectExtensions, CustomerRole,
} from '../types';

// Customer functional roles. Source of truth — stakeholder pickers read
// roles via getCustomerRoles() which prefers customer.roles when set, then
// falls back to this map. Migration backfills customer.roles from this map
// on store load. Lets a single customer wear multiple hats (Atlantic
// Capital = developer + GC) without changing the single-value CustomerType.
export const CUSTOMER_ROLES_BACKFILL: Record<string, CustomerRole[]> = {
  c1:  ['gc'],
  c2:  ['architect'],         // Nair Design Studio — designers can specify
  c3:  ['architect'],
  c4:  ['end_user'],          // Kim Floor Solutions — showroom is the end user of our product
  c5:  ['gc'],
  c6:  ['architect'],
  c7:  ['gc'],
  c8:  ['architect'],
  c9:  ['end_user'],
  c10: ['developer'],         // Hines Property Group — develops + owns
  c11: ['developer', 'gc'],   // Atlantic Capital — design-build, both hats
  c12: ['end_user'],
  c13: ['architect'],
  c14: ['developer'],         // Vineyard Hotel Group — develops + operates
  c15: ['end_user'],          // Sterling Biopharm — they occupy the lab
  c16: ['architect'],
  c17: ['gc'],                // Calhoun Public Works — GC for municipal jobs
};

// Lookup helper that prefers an explicit customer.roles array but falls back
// to the seed map. Empty array if neither has data.
export function getCustomerRoles(customer: Customer): CustomerRole[] {
  if (customer.roles && customer.roles.length > 0) return customer.roles;
  return CUSTOMER_ROLES_BACKFILL[customer.id] ?? [];
}

// ── CUSTOMERS ────────────────────────────────────────────────
export const seedCustomers: Customer[] = [
  {
    id: 'c1', name: 'Marcus Webb', company: 'Webb Construction', type: 'Contractor',
    email: 'marcus@webbconstruction.com', phone: '404-555-0101',
    billingAddress: '1200 Peachtree St NE', billingCity: 'Atlanta', billingState: 'GA', billingZip: '30309',
    contacts: [
      { id: 'c1-ct1', name: 'Marcus Webb', title: 'Owner', email: 'marcus@webbconstruction.com', phone: '404-555-0101', isPrimary: true },
      { id: 'c1-ct2', name: 'Dana Webb', title: 'Project Manager', email: 'dana@webbconstruction.com', phone: '404-555-0102', isPrimary: false },
    ],
    shipToAddresses: [
      { id: 'c1-s1', label: 'Main Office', address: '1200 Peachtree St NE', city: 'Atlanta', state: 'GA', zip: '30309', isDefault: true },
      { id: 'c1-s2', label: 'Warehouse', address: '55 Industrial Blvd', city: 'Smyrna', state: 'GA', zip: '30080', isDefault: false },
    ],
    notes: 'Preferred contractor for Buckhead high-rises.', createdDate: '2024-01-15',
  },
  {
    id: 'c2', name: 'Priya Nair', company: 'Nair Design Studio', type: 'Designer',
    email: 'priya@nairdesign.com', phone: '678-555-0201',
    billingAddress: '340 Ponce De Leon Ave', billingCity: 'Atlanta', billingState: 'GA', billingZip: '30308',
    contacts: [
      { id: 'c2-ct1', name: 'Priya Nair', title: 'Principal Designer', email: 'priya@nairdesign.com', phone: '678-555-0201', isPrimary: true },
    ],
    shipToAddresses: [
      { id: 'c2-s1', label: 'Studio', address: '340 Ponce De Leon Ave', city: 'Atlanta', state: 'GA', zip: '30308', isDefault: true },
    ],
    createdDate: '2024-02-20',
  },
  {
    id: 'c3', name: 'Tom Greer', company: 'Greer Architecture', type: 'Architect',
    email: 'tom@greerarch.com', phone: '770-555-0301',
    billingAddress: '500 Commerce Dr', billingCity: 'Marietta', billingState: 'GA', billingZip: '30060',
    contacts: [
      { id: 'c3-ct1', name: 'Tom Greer', title: 'Principal Architect', email: 'tom@greerarch.com', phone: '770-555-0301', isPrimary: true },
      { id: 'c3-ct2', name: 'Lisa Park', title: 'Project Architect', email: 'lisa@greerarch.com', phone: '770-555-0302', isPrimary: false },
    ],
    shipToAddresses: [
      { id: 'c3-s1', label: 'Office', address: '500 Commerce Dr', city: 'Marietta', state: 'GA', zip: '30060', isDefault: true },
    ],
    createdDate: '2024-01-28',
  },
  {
    id: 'c4', name: 'Sandra Kim', company: 'Kim Floor Solutions', type: 'Dealer',
    email: 'sandra@kimfloors.com', phone: '404-555-0401',
    billingAddress: '88 Northside Dr', billingCity: 'Atlanta', billingState: 'GA', billingZip: '30318',
    contacts: [
      { id: 'c4-ct1', name: 'Sandra Kim', title: 'Owner', email: 'sandra@kimfloors.com', phone: '404-555-0401', isPrimary: true },
    ],
    shipToAddresses: [
      { id: 'c4-s1', label: 'Showroom', address: '88 Northside Dr', city: 'Atlanta', state: 'GA', zip: '30318', isDefault: true },
      { id: 'c4-s2', label: 'Warehouse', address: '200 Fulton Industrial', city: 'Atlanta', state: 'GA', zip: '30336', isDefault: false },
    ],
    createdDate: '2024-03-05',
  },
  {
    id: 'c5', name: 'Derek Johnson', company: 'Johnson Renovations', type: 'Contractor',
    email: 'derek@johnsonreno.com', phone: '912-555-0501',
    billingAddress: '1400 Bull St', billingCity: 'Savannah', billingState: 'GA', billingZip: '31401',
    contacts: [
      { id: 'c5-ct1', name: 'Derek Johnson', title: 'Owner', email: 'derek@johnsonreno.com', phone: '912-555-0501', isPrimary: true },
    ],
    shipToAddresses: [
      { id: 'c5-s1', label: 'Yard', address: '1400 Bull St', city: 'Savannah', state: 'GA', zip: '31401', isDefault: true },
    ],
    createdDate: '2024-04-10',
  },
  {
    id: 'c6', name: 'Alicia Mendez', company: 'Mendez Interiors', type: 'Designer',
    email: 'alicia@mendezinteriors.com', phone: '706-555-0601',
    billingAddress: '210 Broad St', billingCity: 'Augusta', billingState: 'GA', billingZip: '30901',
    contacts: [
      { id: 'c6-ct1', name: 'Alicia Mendez', title: 'Lead Designer', email: 'alicia@mendezinteriors.com', phone: '706-555-0601', isPrimary: true },
    ],
    shipToAddresses: [
      { id: 'c6-s1', label: 'Studio', address: '210 Broad St', city: 'Augusta', state: 'GA', zip: '30901', isDefault: true },
    ],
    createdDate: '2024-05-02',
  },
  {
    id: 'c7', name: 'Ray Stafford', company: 'Stafford Commercial Build', type: 'Contractor',
    email: 'ray@staffordbuild.com', phone: '478-555-0701',
    billingAddress: '300 Cherry St', billingCity: 'Macon', billingState: 'GA', billingZip: '31201',
    contacts: [
      { id: 'c7-ct1', name: 'Ray Stafford', title: 'President', email: 'ray@staffordbuild.com', phone: '478-555-0701', isPrimary: true },
      { id: 'c7-ct2', name: 'Beth Stafford', title: 'Estimator', email: 'beth@staffordbuild.com', phone: '478-555-0702', isPrimary: false },
    ],
    shipToAddresses: [
      { id: 'c7-s1', label: 'Office', address: '300 Cherry St', city: 'Macon', state: 'GA', zip: '31201', isDefault: true },
    ],
    createdDate: '2024-05-18',
  },
  {
    id: 'c8', name: 'Janet Osei', company: 'Osei Architecture Group', type: 'Architect',
    email: 'janet@oseiarch.com', phone: '404-555-0801',
    billingAddress: '999 Piedmont Ave NE', billingCity: 'Atlanta', billingState: 'GA', billingZip: '30309',
    contacts: [
      { id: 'c8-ct1', name: 'Janet Osei', title: 'Managing Partner', email: 'janet@oseiarch.com', phone: '404-555-0801', isPrimary: true },
    ],
    shipToAddresses: [
      { id: 'c8-s1', label: 'Office', address: '999 Piedmont Ave NE', city: 'Atlanta', state: 'GA', zip: '30309', isDefault: true },
    ],
    createdDate: '2024-06-01',
  },
  {
    id: 'c9', name: 'Brian Tate', company: 'Tate Floor Center', type: 'Dealer',
    email: 'brian@tatefloors.com', phone: '770-555-0901',
    billingAddress: '750 Dallas Hwy', billingCity: 'Marietta', billingState: 'GA', billingZip: '30064',
    contacts: [
      { id: 'c9-ct1', name: 'Brian Tate', title: 'Owner', email: 'brian@tatefloors.com', phone: '770-555-0901', isPrimary: true },
    ],
    shipToAddresses: [
      { id: 'c9-s1', label: 'Showroom', address: '750 Dallas Hwy', city: 'Marietta', state: 'GA', zip: '30064', isDefault: true },
    ],
    createdDate: '2024-07-14',
  },
  {
    id: 'c10', name: 'Carol Hines', company: 'Hines Property Group', type: 'Contractor',
    email: 'carol@hinesproperty.com', phone: '404-555-1001',
    billingAddress: '1600 Howell Mill Rd', billingCity: 'Atlanta', billingState: 'GA', billingZip: '30318',
    contacts: [
      { id: 'c10-ct1', name: 'Carol Hines', title: 'Director', email: 'carol@hinesproperty.com', phone: '404-555-1001', isPrimary: true },
      { id: 'c10-ct2', name: 'Marcus Lane', title: 'Site Supervisor', email: 'mlane@hinesproperty.com', phone: '404-555-1002', isPrimary: false },
    ],
    shipToAddresses: [
      { id: 'c10-s1', label: 'HQ', address: '1600 Howell Mill Rd', city: 'Atlanta', state: 'GA', zip: '30318', isDefault: true },
    ],
    createdDate: '2024-08-20',
  },
  {
    id: 'c11', name: 'Diana Park', company: 'Atlantic Capital Developers', type: 'Contractor',
    email: 'diana@atlcapital.com', phone: '404-555-1101',
    billingAddress: '3344 Peachtree Rd NE', billingCity: 'Atlanta', billingState: 'GA', billingZip: '30326',
    contacts: [
      { id: 'c11-ct1', name: 'Diana Park', title: 'VP Construction', email: 'diana@atlcapital.com', phone: '404-555-1101', isPrimary: true },
      { id: 'c11-ct2', name: 'James Wu', title: 'Project Director', email: 'jwu@atlcapital.com', phone: '404-555-1102', isPrimary: false },
    ],
    shipToAddresses: [
      { id: 'c11-s1', label: 'HQ', address: '3344 Peachtree Rd NE', city: 'Atlanta', state: 'GA', zip: '30326', isDefault: true },
    ],
    createdDate: '2024-08-12',
  },
  {
    id: 'c12', name: 'Marcus Reilly', company: 'Reilly Residence', type: 'Homeowner',
    email: 'mreilly@gmail.com', phone: '404-555-1201',
    billingAddress: '1065 Peachtree St NE Unit PH', billingCity: 'Atlanta', billingState: 'GA', billingZip: '30309',
    contacts: [
      { id: 'c12-ct1', name: 'Marcus Reilly', title: 'Owner', email: 'mreilly@gmail.com', phone: '404-555-1201', isPrimary: true },
    ],
    shipToAddresses: [
      { id: 'c12-s1', label: 'Residence', address: '1065 Peachtree St NE Unit PH', city: 'Atlanta', state: 'GA', zip: '30309', isDefault: true },
    ],
    createdDate: '2025-03-10',
  },
  // ── Dormant-only customers (each has one big quiet project) ──
  {
    id: 'c13', name: 'Eli Patterson', company: 'Pinnacle Architects', type: 'Architect',
    email: 'eli@pinnaclearch.com', phone: '404-555-1301',
    billingAddress: '4100 Northside Pkwy NW', billingCity: 'Atlanta', billingState: 'GA', billingZip: '30327',
    contacts: [
      { id: 'c13-ct1', name: 'Eli Patterson', title: 'Principal', email: 'eli@pinnaclearch.com', phone: '404-555-1301', isPrimary: true },
    ],
    shipToAddresses: [
      { id: 'c13-s1', label: 'Office', address: '4100 Northside Pkwy NW', city: 'Atlanta', state: 'GA', zip: '30327', isDefault: true },
    ],
    createdDate: '2024-06-10',
  },
  {
    id: 'c14', name: 'Roberto Gallo', company: 'Vineyard Hotel Group', type: 'Contractor',
    email: 'roberto@vineyardhotels.com', phone: '912-555-1401',
    billingAddress: '500 E River St', billingCity: 'Savannah', billingState: 'GA', billingZip: '31401',
    contacts: [
      { id: 'c14-ct1', name: 'Roberto Gallo', title: 'VP Development', email: 'roberto@vineyardhotels.com', phone: '912-555-1401', isPrimary: true },
    ],
    shipToAddresses: [
      { id: 'c14-s1', label: 'HQ', address: '500 E River St', city: 'Savannah', state: 'GA', zip: '31401', isDefault: true },
    ],
    createdDate: '2024-05-22',
  },
  {
    id: 'c15', name: 'Priya Desai', company: 'Sterling Biopharm', type: 'Contractor',
    email: 'pdesai@sterlingbio.com', phone: '404-555-1501',
    billingAddress: '2200 Lake Park Dr', billingCity: 'Smyrna', billingState: 'GA', billingZip: '30080',
    contacts: [
      { id: 'c15-ct1', name: 'Priya Desai', title: 'Facilities Director', email: 'pdesai@sterlingbio.com', phone: '404-555-1501', isPrimary: true },
    ],
    shipToAddresses: [
      { id: 'c15-s1', label: 'Office', address: '2200 Lake Park Dr', city: 'Smyrna', state: 'GA', zip: '30080', isDefault: true },
    ],
    createdDate: '2024-07-15',
  },
  {
    id: 'c16', name: 'Vivienne Marsh', company: 'Highline Design Studio', type: 'Designer',
    email: 'viv@highlinedesign.com', phone: '404-555-1601',
    billingAddress: '888 W Marietta St NW', billingCity: 'Atlanta', billingState: 'GA', billingZip: '30318',
    contacts: [
      { id: 'c16-ct1', name: 'Vivienne Marsh', title: 'Founder', email: 'viv@highlinedesign.com', phone: '404-555-1601', isPrimary: true },
    ],
    shipToAddresses: [
      { id: 'c16-s1', label: 'Studio', address: '888 W Marietta St NW', city: 'Atlanta', state: 'GA', zip: '30318', isDefault: true },
    ],
    createdDate: '2024-06-30',
  },
  {
    id: 'c17', name: 'Wes Calhoun', company: 'Calhoun Public Works', type: 'Contractor',
    email: 'wes@calhounpw.com', phone: '706-555-1701',
    billingAddress: '320 Court St', billingCity: 'Calhoun', billingState: 'GA', billingZip: '30701',
    contacts: [
      { id: 'c17-ct1', name: 'Wes Calhoun', title: 'Director', email: 'wes@calhounpw.com', phone: '706-555-1701', isPrimary: true },
    ],
    shipToAddresses: [
      { id: 'c17-s1', label: 'Office', address: '320 Court St', city: 'Calhoun', state: 'GA', zip: '30701', isDefault: true },
    ],
    createdDate: '2024-08-05',
  },
  // ── Flooring sub-contractors / dealers (used by the GC↔sub learning view) ──
  {
    id: 'c18', name: 'Donovan Reece', company: 'Atlantic Flooring Group', type: 'Dealer',
    email: 'donovan@atlanticflooring.com', phone: '404-555-1801',
    billingAddress: '1200 Marietta St NW', billingCity: 'Atlanta', billingState: 'GA', billingZip: '30318',
    contacts: [
      { id: 'c18-ct1', name: 'Donovan Reece', title: 'Commercial Sales Director', email: 'donovan@atlanticflooring.com', phone: '404-555-1801', isPrimary: true },
    ],
    shipToAddresses: [
      { id: 'c18-s1', label: 'Office', address: '1200 Marietta St NW', city: 'Atlanta', state: 'GA', zip: '30318', isDefault: true },
    ],
    createdDate: '2024-03-22',
  },
  {
    id: 'c19', name: 'Mia Holloway', company: 'Coastal Surfaces Inc', type: 'Dealer',
    email: 'mia@coastalsurfaces.com', phone: '912-555-1901',
    billingAddress: '2400 Skidaway Rd', billingCity: 'Savannah', billingState: 'GA', billingZip: '31404',
    contacts: [
      { id: 'c19-ct1', name: 'Mia Holloway', title: 'President', email: 'mia@coastalsurfaces.com', phone: '912-555-1901', isPrimary: true },
    ],
    shipToAddresses: [
      { id: 'c19-s1', label: 'Office', address: '2400 Skidaway Rd', city: 'Savannah', state: 'GA', zip: '31404', isDefault: true },
    ],
    createdDate: '2024-04-10',
  },
  {
    id: 'c20', name: 'Harlan Boyd', company: 'Piedmont Floor Specialists', type: 'Dealer',
    email: 'harlan@piedmontfloor.com', phone: '706-555-2001',
    billingAddress: '1100 Walton Way', billingCity: 'Augusta', billingState: 'GA', billingZip: '30901',
    contacts: [
      { id: 'c20-ct1', name: 'Harlan Boyd', title: 'GM', email: 'harlan@piedmontfloor.com', phone: '706-555-2001', isPrimary: true },
    ],
    shipToAddresses: [
      { id: 'c20-s1', label: 'Showroom', address: '1100 Walton Way', city: 'Augusta', state: 'GA', zip: '30901', isDefault: true },
    ],
    createdDate: '2024-05-18',
  },
];

// ── PRODUCTS ─────────────────────────────────────────────────
export const seedProducts: Product[] = [
  {
    id: 'p1', trinityName: 'StoneCreek LVP', trinitySku: 'TRN-LVP-001',
    category: 'LVP', description: '12mil wear layer, waterproof, click-lock',
    specs: { thickness: '5mm', wearLayer: '12mil', finish: 'Matte', width: '7in', length: '48in' },
    privateLabels: [
      { brand: 'COREtec', productName: 'COREtec Pro Plus', sku: 'CT-PP-448', listPrice: 3.89, netPrice: 2.60 },
      { brand: 'Shaw', productName: 'Shaw Floorte Pro', sku: 'SH-FP-112', listPrice: 3.75, netPrice: 2.50 },
    ],
    tags: ['waterproof', 'commercial', 'click-lock'], brochureIds: ['b1', 'b2'],
    listPrice: 3.99, netPrice: 2.65, unit: 'sq ft', sqftPerCarton: 22.4, status: 'active',
  },
  {
    id: 'p2', trinityName: 'BlueSky SPC', trinitySku: 'TRN-SPC-001',
    category: 'SPC', description: 'Stone polymer core, 20mil wear layer',
    specs: { thickness: '6mm', wearLayer: '20mil', finish: 'Embossed', width: '9in', length: '60in' },
    privateLabels: [
      { brand: 'Armstrong', productName: 'Armstrong Vivero Plus', sku: 'AW-VP-203', listPrice: 4.29, netPrice: 2.90 },
      { brand: 'Mannington', productName: 'Mannington Adura Max', sku: 'MN-AM-504', listPrice: 4.15, netPrice: 2.80 },
    ],
    tags: ['waterproof', 'stone-core', 'heavy-commercial'], brochureIds: ['b1'],
    listPrice: 4.49, netPrice: 3.00, unit: 'sq ft', sqftPerCarton: 20.0, status: 'active',
  },
  {
    id: 'p3', trinityName: 'Peachtree Oak EHW', trinitySku: 'TRN-EHW-001',
    category: 'Engineered Hardwood', description: '3-ply engineered, white oak veneer',
    specs: { thickness: '3/8in', veneer: 'White Oak', finish: 'UV Oil', width: '5in', janka: '1360' },
    privateLabels: [
      { brand: 'Mohawk', productName: 'Mohawk TecWood', sku: 'MH-TW-301', listPrice: 6.20, netPrice: 4.10 },
      { brand: 'Armstrong', productName: 'Armstrong Prime Harvest', sku: 'AW-PH-188', listPrice: 6.00, netPrice: 3.95 },
    ],
    tags: ['hardwood', 'natural', 'residential'], brochureIds: ['b3'],
    listPrice: 6.49, netPrice: 4.25, unit: 'sq ft', sqftPerCarton: 19.8, status: 'active',
  },
  {
    id: 'p4', trinityName: 'GraniteShield Tile', trinitySku: 'TRN-TILE-001',
    category: 'Tile', description: 'Porcelain 24x24, granite look',
    specs: { size: '24x24', material: 'Porcelain', pei: '4', finish: 'Polished' },
    privateLabels: [
      { brand: 'Daltile', productName: 'Daltile Degree', sku: 'DL-DG-2424', listPrice: 3.50, netPrice: 2.20 },
      { brand: 'MSI', productName: 'MSI Everline', sku: 'MSI-EV-24', listPrice: 3.35, netPrice: 2.10 },
    ],
    tags: ['tile', 'porcelain', 'commercial', 'large-format'], brochureIds: ['b4'],
    listPrice: 3.75, netPrice: 2.35, unit: 'sq ft', status: 'active',
  },
  {
    id: 'p5', trinityName: 'RedRidge Laminate', trinitySku: 'TRN-LAM-001',
    category: 'Laminate', description: 'AC4 laminate, hand-scraped texture',
    specs: { thickness: '12mm', ac: 'AC4', finish: 'Hand-Scraped', width: '5in' },
    privateLabels: [
      { brand: 'Pergo', productName: 'Pergo Outlast+', sku: 'PG-OL-512', listPrice: 2.89, netPrice: 1.85 },
      { brand: 'Shaw', productName: 'Shaw Repel Laminate', sku: 'SH-RL-205', listPrice: 2.75, netPrice: 1.75 },
    ],
    tags: ['laminate', 'scraped', 'budget'], brochureIds: ['b5'],
    listPrice: 2.99, netPrice: 1.90, unit: 'sq ft', sqftPerCarton: 21.6, status: 'active',
  },
  {
    id: 'p6', trinityName: 'SilverStream Carpet', trinitySku: 'TRN-CRPT-001',
    category: 'Carpet', description: 'Solution-dyed nylon, commercial loop pile',
    specs: { fiber: 'Nylon', pile: 'Loop', weight: '28oz', width: '12ft' },
    privateLabels: [
      { brand: 'Mohawk', productName: 'Mohawk Airo', sku: 'MH-AR-622', listPrice: 2.40, netPrice: 1.55 },
      { brand: 'Shaw', productName: 'Shaw Capital III', sku: 'SH-C3-188', listPrice: 2.25, netPrice: 1.45 },
    ],
    tags: ['carpet', 'commercial', 'loop', 'nylon'], brochureIds: ['b6'],
    listPrice: 2.49, netPrice: 1.60, unit: 'sq yd', status: 'active',
  },
  {
    id: 'p7', trinityName: 'MapleCrest HW', trinitySku: 'TRN-HW-001',
    category: 'Hardwood', description: 'Solid red maple, 3/4in, site-finished',
    specs: { species: 'Red Maple', thickness: '3/4in', grade: 'Select', width: '3.25in', janka: '1450' },
    privateLabels: [
      { brand: 'Bruce', productName: 'Bruce Maple Solid', sku: 'BR-MS-325', listPrice: 7.50, netPrice: 5.00 },
      { brand: 'Armstrong', productName: 'Armstrong Maple Solid', sku: 'AW-MS-325', listPrice: 7.25, netPrice: 4.80 },
    ],
    tags: ['hardwood', 'solid', 'maple', 'site-finished'], brochureIds: ['b3'],
    listPrice: 7.99, netPrice: 5.25, unit: 'sq ft', sqftPerCarton: 20.0, status: 'active',
  },
  {
    id: 'p8', trinityName: 'AquaShield LVT', trinitySku: 'TRN-LVT-001',
    category: 'LVP', description: 'Glue-down LVT, 6mil wear layer, commercial',
    specs: { thickness: '3mm', wearLayer: '6mil', finish: 'Satin', format: 'Glue-Down' },
    privateLabels: [
      { brand: 'Armstrong', productName: 'Armstrong Alterna', sku: 'AW-AL-800', listPrice: 3.20, netPrice: 2.05 },
      { brand: 'Karndean', productName: 'Karndean Van Gogh', sku: 'KD-VG-302', listPrice: 3.45, netPrice: 2.20 },
    ],
    tags: ['glue-down', 'commercial', 'LVT'], brochureIds: ['b2'],
    listPrice: 3.35, netPrice: 2.15, unit: 'sq ft', status: 'active',
  },
  {
    id: 'p9', trinityName: 'CoastalCork Natural', trinitySku: 'TRN-CORK-001',
    category: 'Cork', description: 'Floating cork, pre-finished, noise reduction',
    specs: { thickness: '10mm', finish: 'UV Lacquer', format: 'Click-Lock', iic: '52dB' },
    privateLabels: [
      { brand: 'USFloors', productName: 'USFloors Natural Cork', sku: 'USF-NC-10', listPrice: 3.80, netPrice: 2.50 },
      { brand: 'Cali', productName: 'Cali Cork Plus', sku: 'CL-CK-210', listPrice: 3.65, netPrice: 2.40 },
    ],
    tags: ['cork', 'eco', 'sound-reduction', 'floating'], brochureIds: [],
    listPrice: 3.99, netPrice: 2.60, unit: 'sq ft', sqftPerCarton: 17.4, status: 'limited',
  },
  {
    id: 'p10', trinityName: 'WoodLook Hex Tile', trinitySku: 'TRN-TILE-002',
    category: 'Tile', description: 'Ceramic hexagon mosaic, 4in face',
    specs: { size: '4in hex', material: 'Ceramic', pei: '3', finish: 'Matte', sheet: '12x12 sheet' },
    privateLabels: [
      { brand: 'Daltile', productName: 'Daltile Keystones', sku: 'DL-KS-4H', listPrice: 6.50, netPrice: 4.20 },
      { brand: 'Florida Tile', productName: 'Florida Tile Arté', sku: 'FT-ART-4H', listPrice: 6.20, netPrice: 4.00 },
    ],
    tags: ['tile', 'mosaic', 'hexagon', 'accent'], brochureIds: ['b4'],
    listPrice: 6.75, netPrice: 4.40, unit: 'sq ft', status: 'active',
  },
];

// ── BROCHURES ────────────────────────────────────────────────
export const seedBrochures: Brochure[] = [
  { id: 'b1', name: 'LVP & SPC Product Guide 2025', brand: 'Trinity Surfaces', category: 'LVP', fileName: 'trinity-lvp-spc-2025.pdf', uploadDate: '2025-01-10', tags: ['lvp', 'spc', 'waterproof'], productIds: ['p1', 'p2'], pageCount: 24, hasFile: false },
  { id: 'b2', name: 'COREtec Full Line Catalog', brand: 'COREtec', category: 'LVP', fileName: 'coretec-2025.pdf', uploadDate: '2025-02-01', tags: ['coretec', 'lvp', 'waterproof'], productIds: ['p1', 'p8'], pageCount: 48, hasFile: false },
  { id: 'b3', name: 'Hardwood Collection Lookbook', brand: 'Trinity Surfaces', category: 'Hardwood', fileName: 'trinity-hardwood-2025.pdf', uploadDate: '2025-01-20', tags: ['hardwood', 'engineered', 'oak', 'maple'], productIds: ['p3', 'p7'], pageCount: 32, hasFile: false },
  { id: 'b4', name: 'Tile & Stone Catalog', brand: 'Daltile', category: 'Tile', fileName: 'daltile-2025.pdf', uploadDate: '2025-03-01', tags: ['tile', 'porcelain', 'daltile'], productIds: ['p4', 'p10'], pageCount: 60, hasFile: false },
  { id: 'b5', name: 'Laminate Flooring Guide', brand: 'Trinity Surfaces', category: 'Laminate', fileName: 'trinity-laminate-2025.pdf', uploadDate: '2025-02-15', tags: ['laminate', 'pergo', 'shaw'], productIds: ['p5'], pageCount: 16, hasFile: false },
  { id: 'b6', name: 'Commercial Carpet Spec Sheet', brand: 'Trinity Surfaces', category: 'Carpet', fileName: 'trinity-carpet-commercial.pdf', uploadDate: '2025-01-05', tags: ['carpet', 'commercial', 'mohawk'], productIds: ['p6'], pageCount: 8, hasFile: false },
  { id: 'b7', name: 'Shaw Floorte Pro Brochure', brand: 'Shaw', category: 'LVP', fileName: 'shaw-floorte-pro.pdf', uploadDate: '2025-03-10', tags: ['shaw', 'lvp', 'floorte'], productIds: ['p1'], pageCount: 20, hasFile: false },
  { id: 'b8', name: 'Mohawk TecWood Brochure', brand: 'Mohawk', category: 'Engineered Hardwood', fileName: 'mohawk-tecwood.pdf', uploadDate: '2025-02-28', tags: ['mohawk', 'tecwood', 'engineered'], productIds: ['p3'], pageCount: 12, hasFile: false },
  { id: 'b9', name: 'Mannington Adura Max Overview', brand: 'Mannington', category: 'SPC', fileName: 'mannington-adura-max.pdf', uploadDate: '2025-03-05', tags: ['mannington', 'spc', 'adura'], productIds: ['p2'], pageCount: 16, hasFile: false },
  { id: 'b10', name: 'Sustainability & Green Building Guide', brand: 'Trinity Surfaces', category: 'Other', fileName: 'trinity-sustainability.pdf', uploadDate: '2025-01-30', tags: ['green', 'leed', 'sustainability'], productIds: [], pageCount: 10, hasFile: false },
];

// ── CATALOGS ─────────────────────────────────────────────────
export const seedCatalogs: Catalog[] = [
  {
    id: 'cat1', name: 'Architect Master Catalog', version: '2025.1', isTemplate: true,
    description: 'Full product line for architecture firms',
    brochureIds: ['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b10'],
    createdDate: '2025-01-01', modifiedDate: '2025-03-01',
    targetAudience: 'Architect', tags: ['architect', 'full-line', 'template'],
  },
  {
    id: 'cat2', name: 'Designer Residential Catalog', version: '2025.1', isTemplate: true,
    description: 'Curated residential products for designers',
    brochureIds: ['b1', 'b3', 'b5', 'b8'],
    createdDate: '2025-01-01', modifiedDate: '2025-02-15',
    targetAudience: 'Designer', tags: ['designer', 'residential', 'template'],
  },
  {
    id: 'cat3', name: 'Contractor Commercial Catalog', version: '2025.1', isTemplate: true,
    description: 'Commercial-grade products for contractors',
    brochureIds: ['b1', 'b2', 'b4', 'b6', 'b9'],
    createdDate: '2025-01-01', modifiedDate: '2025-03-10',
    targetAudience: 'Contractor', tags: ['contractor', 'commercial', 'template'],
  },
  {
    id: 'cat4', name: 'Webb Construction Custom Package', version: '1.0', isTemplate: false,
    parentCatalogId: 'cat3',
    description: 'Custom catalog for Webb Construction Buckhead project',
    brochureIds: ['b1', 'b2', 'b6', 'b9'],
    createdDate: '2025-03-15', modifiedDate: '2025-03-15',
    targetAudience: 'Contractor', tags: ['custom', 'webb', 'buckhead'], customerId: 'c1',
  },
];

// ── PROJECTS ──────────────────────────────────────────────────
// Type includes ProjectExtensions so the new opportunity-shaped fields
// (salesRepId, projectType, opportunityStage, etc.) are populated on seed.
// Existing pages that read `Project` keep working — extensions are optional.
export const seedProjects: (Project & ProjectExtensions)[] = [
  {
    id: 'pr1', customerId: 'c1', name: 'Buckhead High-Rise Lobby', status: 'Active',
    description: 'Full lobby and corridor flooring for 24-story luxury residential tower',
    address: '2800 Peachtree Rd NE, Atlanta, GA 30305',
    value: 185000, productIds: ['p2', 'p4'], sampleOrderIds: ['so1'],
    notes: [{ id: 'n1', date: '2025-03-01', text: 'Client approved SPC samples', author: 'Colton P.' }],
    createdDate: '2025-02-15', anticipatedOrderDate: '2025-05-01',
    // Extensions
    opportunityId: 'OPP-2025-0142', salesRepId: 'rep-sarah', salesLocationId: '310',
    projectType: 'multifamily', opportunityStatus: 'active', opportunityStage: 'bidding',
    nextStep: 'Submit formal SPC quote for 8,200 sqft',
    updatedDate: '2025-04-10', architecturalFirmId: 'c3', gcCustomerId: 'c1',
    developerCustomerId: 'c11', jobLocation: 'Atlanta, GA',
    bidders: [{ id: 'bid-1', customerId: 'c1', quotedDate: '2025-03-15', quotedAmount: 178000 }],
    lastTouchAt: '2025-04-10T09:22:00Z',
  },
  {
    id: 'pr2', customerId: 'c2', name: 'Midtown Penthouse Renovation', status: 'Bidding',
    description: 'Full-floor renovation of penthouse unit with premium engineered hardwood',
    address: '1065 Peachtree St NE Unit PH, Atlanta, GA 30309',
    value: 42000, productIds: ['p3', 'p7'], sampleOrderIds: ['so2'],
    notes: [],
    createdDate: '2025-03-10', anticipatedOrderDate: '2025-06-15',
    opportunityId: 'OPP-2025-0156', salesRepId: 'rep-sarah', salesLocationId: '310',
    projectType: 'single_family', opportunityStatus: 'active', opportunityStage: 'design',
    nextStep: 'Follow up on sample feedback',
    updatedDate: '2025-03-22', architecturalFirmId: 'c2',
    endUserCustomerId: 'c12', jobLocation: 'Atlanta, GA',
    bidders: [],
    lastTouchAt: '2025-03-22T11:00:00Z',
  },
  {
    id: 'pr3', customerId: 'c3', name: 'Marietta Office Park', status: 'Lead',
    description: 'New commercial office park, 18,000 sqft, common areas and suites',
    address: '400 Franklin Gateway SE, Marietta, GA 30067',
    value: 95000, productIds: ['p1', 'p6'], sampleOrderIds: [],
    notes: [],
    createdDate: '2025-04-01', anticipatedOrderDate: '2025-08-01',
    opportunityId: 'OPP-2025-0188', salesRepId: 'rep-sarah', salesLocationId: '310',
    projectType: 'corporate', opportunityStatus: 'active', opportunityStage: 'lead_qualification',
    nextStep: 'Send commercial catalog and schedule lunch & learn',
    updatedDate: '2025-04-01', architecturalFirmId: 'c3',
    jobLocation: 'Marietta, GA', bidders: [],
    lastTouchAt: '2025-04-01T10:30:00Z',
  },
  {
    id: 'pr4', customerId: 'c4', name: 'Kim Floors Showroom Remodel', status: 'Won',
    description: 'Showroom floor demo with Trinity products to show end customers',
    address: '88 Northside Dr, Atlanta, GA 30318',
    value: 12500, productIds: ['p1', 'p2', 'p3', 'p4', 'p5'], sampleOrderIds: [],
    notes: [{ id: 'n2', date: '2025-02-01', text: 'PO received, scheduling install', author: 'Colton P.' }],
    createdDate: '2025-01-20', anticipatedOrderDate: '2025-03-01', closingDate: '2025-03-28',
    opportunityId: 'OPP-2025-0098', salesRepId: 'rep-sarah', salesLocationId: '310',
    projectType: 'retail', opportunityStatus: 'won', opportunityStage: 'orders_placed',
    nextStep: 'Schedule install with Sandra',
    updatedDate: '2025-03-28', endUserCustomerId: 'c4', jobLocation: 'Atlanta, GA',
    bidders: [],
    lastTouchAt: '2025-03-28T15:00:00Z',
  },
  {
    id: 'pr5', customerId: 'c5', name: 'Savannah Historic Renovation', status: 'Active',
    description: 'Restoration of historic downtown property with cork and hardwood',
    address: '125 E Bay St, Savannah, GA 31401',
    value: 28000, productIds: ['p9', 'p7'], sampleOrderIds: [],
    notes: [],
    createdDate: '2025-03-20', anticipatedOrderDate: '2025-06-01',
    opportunityId: 'OPP-2025-0173', salesRepId: 'rep-derek', salesLocationId: '410',
    projectType: 'hospitality', opportunityStatus: 'active', opportunityStage: 'design',
    nextStep: 'Confirm cork order qty',
    updatedDate: '2025-04-02', gcCustomerId: 'c5', jobLocation: 'Savannah, GA',
    bidders: [],
    lastTouchAt: '2025-04-02T13:30:00Z',
  },
  {
    id: 'pr6', customerId: 'c7', name: 'Macon Medical Office Build', status: 'Bidding',
    description: 'Medical office LVT installation, healthcare spec requirements',
    address: '600 Professional Blvd, Macon, GA 31210',
    value: 67000, productIds: ['p8', 'p6'], sampleOrderIds: [],
    notes: [],
    createdDate: '2025-04-05', anticipatedOrderDate: '2025-07-15',
    opportunityId: 'OPP-2025-0195', salesRepId: 'rep-sarah', salesLocationId: '310',
    projectType: 'healthcare', opportunityStatus: 'active', opportunityStage: 'bidding',
    nextStep: 'Submit LVT spec to Beth at Stafford',
    updatedDate: '2025-04-08', gcCustomerId: 'c7', jobLocation: 'Macon, GA',
    bidders: [{ id: 'bid-2', customerId: 'c7', quotedDate: '2025-04-08', quotedAmount: 64500 }],
    lastTouchAt: '2025-04-08T09:15:00Z',
  },
  {
    id: 'pr7', customerId: 'c8', name: 'Atlanta Mixed-Use Development', status: 'Lead',
    description: '60,000 sqft mixed-use retail and residential, full flooring package',
    address: '1800 Howell Mill Rd NW, Atlanta, GA 30318',
    value: 310000, productIds: ['p1', 'p2', 'p4', 'p6'], sampleOrderIds: [],
    notes: [],
    createdDate: '2025-04-10', anticipatedOrderDate: '2026-01-01',
    opportunityId: 'OPP-2025-0210', salesRepId: 'rep-sarah', salesLocationId: '310',
    projectType: 'mixed_use', opportunityStatus: 'active', opportunityStage: 'bidding',
    nextStep: 'Submit RFP pricing by April 25',
    updatedDate: '2025-04-11', architecturalFirmId: 'c8',
    developerCustomerId: 'c10', jobLocation: 'Atlanta, GA',
    bidders: [],
    lastTouchAt: '2025-04-11T08:15:00Z',
  },
  {
    id: 'pr8', customerId: 'c10', name: 'Howell Mill Townhomes', status: 'Lost',
    description: '24-unit townhome development, LVP throughout',
    address: '1700 Howell Mill Rd NW, Atlanta, GA 30318',
    value: 54000, productIds: ['p1'], sampleOrderIds: [],
    notes: [{ id: 'n3', date: '2025-02-28', text: 'Lost to competitor — price gap', author: 'Colton P.' }],
    createdDate: '2025-01-15', anticipatedOrderDate: '2025-04-01', closingDate: '2025-03-01',
    opportunityId: 'OPP-2025-0085', salesRepId: 'rep-sarah', salesLocationId: '310',
    projectType: 'multifamily', opportunityStatus: 'lost', opportunityStage: 'closed',
    nextStep: 'Maintain relationship for next project',
    updatedDate: '2025-03-01', developerCustomerId: 'c10', jobLocation: 'Atlanta, GA',
    bidders: [],
    lastTouchAt: '2025-03-01T12:00:00Z',
  },

  // ── Additional projects: dormant + active mix across reps ──
  {
    id: 'pr9', customerId: 'c3', name: 'Cobb Senior Living Phase II', status: 'Bidding',
    description: '180-unit senior living community, common areas + units',
    address: '2200 Roswell Rd, Marietta, GA 30062',
    value: 220000, productIds: ['p1', 'p6'], sampleOrderIds: [],
    notes: [],
    createdDate: '2024-11-15', anticipatedOrderDate: '2025-09-01',
    opportunityId: 'OPP-2024-0421', salesRepId: 'rep-sarah', salesLocationId: '310',
    projectType: 'multifamily', opportunityStatus: 'active', opportunityStage: 'bidding',
    nextStep: 'Re-engage — quiet since November',
    updatedDate: '2024-11-20', architecturalFirmId: 'c3', jobLocation: 'Marietta, GA',
    bidders: [],
    lastTouchAt: '2024-11-20T14:00:00Z',  // DORMANT
  },
  {
    id: 'pr10', customerId: 'c8', name: 'Gwinnett County Library Renovation', status: 'Lead',
    description: 'Public library renovation, 12,000 sqft, government spec',
    address: '1001 Lawrenceville Hwy, Lawrenceville, GA 30046',
    value: 88000, productIds: ['p4', 'p6'], sampleOrderIds: [],
    notes: [],
    createdDate: '2024-10-08', anticipatedOrderDate: '2025-12-01',
    opportunityId: 'OPP-2024-0388', salesRepId: 'rep-sarah', salesLocationId: '310',
    projectType: 'government', opportunityStatus: 'active', opportunityStage: 'lead_qualification',
    nextStep: 'Send public-sector pricing structure',
    updatedDate: '2024-10-15', architecturalFirmId: 'c8', jobLocation: 'Lawrenceville, GA',
    bidders: [],
    lastTouchAt: '2024-10-15T10:00:00Z',  // DORMANT
  },
  {
    id: 'pr11', customerId: 'c2', name: 'Inman Park Boutique Hotel', status: 'Active',
    description: '32-room boutique hotel, lobby + corridors + 4 suites',
    address: '895 Edgewood Ave NE, Atlanta, GA 30307',
    value: 140000, productIds: ['p3', 'p9', 'p4'], sampleOrderIds: [],
    notes: [],
    createdDate: '2024-09-03', anticipatedOrderDate: '2025-08-01',
    opportunityId: 'OPP-2024-0345', salesRepId: 'rep-sarah', salesLocationId: '310',
    projectType: 'hospitality', opportunityStatus: 'active', opportunityStage: 'design',
    nextStep: 'Reconnect with Priya on revised palette',
    updatedDate: '2024-12-10', architecturalFirmId: 'c2', jobLocation: 'Atlanta, GA',
    bidders: [],
    lastTouchAt: '2024-12-10T16:45:00Z',  // DORMANT
  },
  {
    id: 'pr12', customerId: 'c1', name: 'Vinings Class A Office Tower', status: 'Bidding',
    description: '32-story Class A office tower, lobby + amenity floors',
    address: '2849 Paces Ferry Rd, Atlanta, GA 30339',
    value: 480000, productIds: ['p4', 'p1', 'p6'], sampleOrderIds: [],
    notes: [],
    createdDate: '2024-08-20', anticipatedOrderDate: '2026-03-01',
    opportunityId: 'OPP-2024-0312', salesRepId: 'rep-sarah', salesLocationId: '310',
    projectType: 'corporate', opportunityStatus: 'active', opportunityStage: 'bidding',
    nextStep: 'Awaiting developer approval on shortlist',
    updatedDate: '2025-01-15', architecturalFirmId: 'c8',
    gcCustomerId: 'c1', developerCustomerId: 'c11', jobLocation: 'Atlanta, GA',
    bidders: [{ id: 'bid-3', customerId: 'c1', quotedDate: '2024-12-15', quotedAmount: 472000 }],
    lastTouchAt: '2025-01-15T11:30:00Z',  // DORMANT
  },
  {
    id: 'pr13', customerId: 'c6', name: 'Augusta Riverwalk Condos', status: 'Active',
    description: '120-unit luxury condo development, river-facing units',
    address: '1 10th St, Augusta, GA 30901',
    value: 195000, productIds: ['p1', 'p3'], sampleOrderIds: [],
    notes: [],
    createdDate: '2025-02-08', anticipatedOrderDate: '2025-10-01',
    opportunityId: 'OPP-2025-0118', salesRepId: 'rep-sarah', salesLocationId: '310',
    projectType: 'multifamily', opportunityStatus: 'active', opportunityStage: 'bidding',
    nextStep: 'Send revised quote with qty discount',
    updatedDate: '2025-04-05', architecturalFirmId: 'c6', jobLocation: 'Augusta, GA',
    bidders: [],
    lastTouchAt: '2025-04-05T14:20:00Z',
  },
  {
    id: 'pr14', customerId: 'c7', name: 'Macon Central High Renovation', status: 'Lead',
    description: 'High school commons + cafeteria flooring replacement',
    address: '2155 Napier Ave, Macon, GA 31204',
    value: 65000, productIds: ['p1', 'p8'], sampleOrderIds: [],
    notes: [],
    createdDate: '2025-03-25', anticipatedOrderDate: '2025-07-01',
    opportunityId: 'OPP-2025-0167', salesRepId: 'rep-sarah', salesLocationId: '310',
    projectType: 'education', opportunityStatus: 'active', opportunityStage: 'lead_qualification',
    nextStep: 'Schedule site walkthrough with Ray',
    updatedDate: '2025-04-09', gcCustomerId: 'c7', jobLocation: 'Macon, GA',
    bidders: [],
    lastTouchAt: '2025-04-09T08:30:00Z',
  },
  {
    id: 'pr15', customerId: 'c9', name: 'Marietta Tate Showroom Refresh', status: 'Active',
    description: 'Existing showroom refresh — Tate wants Trinity-branded displays',
    address: '750 Dallas Hwy, Marietta, GA 30064',
    value: 18500, productIds: ['p1', 'p3', 'p5'], sampleOrderIds: [],
    notes: [],
    createdDate: '2024-10-30', anticipatedOrderDate: '2025-05-15',
    opportunityId: 'OPP-2024-0402', salesRepId: 'rep-sarah', salesLocationId: '310',
    projectType: 'retail', opportunityStatus: 'active', opportunityStage: 'design',
    nextStep: 'Reconfirm display product mix',
    updatedDate: '2024-12-22', endUserCustomerId: 'c9', jobLocation: 'Marietta, GA',
    bidders: [],
    lastTouchAt: '2024-12-22T11:00:00Z',  // DORMANT
  },
  {
    id: 'pr16', customerId: 'c5', name: 'Savannah Coastal Resort Cabanas', status: 'Bidding',
    description: 'New cabana cluster + spa, 14,000 sqft of cork + tile',
    address: '500 Tybee Rd, Savannah, GA 31410',
    value: 92000, productIds: ['p9', 'p4'], sampleOrderIds: [],
    notes: [],
    createdDate: '2025-01-22', anticipatedOrderDate: '2025-08-15',
    opportunityId: 'OPP-2025-0102', salesRepId: 'rep-derek', salesLocationId: '410',
    projectType: 'hospitality', opportunityStatus: 'active', opportunityStage: 'bidding',
    nextStep: 'Finalize cork qty with developer',
    updatedDate: '2025-04-03', gcCustomerId: 'c5', jobLocation: 'Tybee Island, GA',
    bidders: [],
    lastTouchAt: '2025-04-03T15:30:00Z',
  },
  {
    id: 'pr17', customerId: 'c10', name: 'Buckhead Luxury Condos', status: 'Lead',
    description: '48-unit luxury condo tower, all-in flooring package',
    address: '3290 Northside Pkwy NW, Atlanta, GA 30327',
    value: 380000, productIds: ['p3', 'p7', 'p4'], sampleOrderIds: [],
    notes: [],
    createdDate: '2025-04-08', anticipatedOrderDate: '2025-11-01',
    opportunityId: 'OPP-2025-0205', salesRepId: 'rep-sarah', salesLocationId: '310',
    projectType: 'multifamily', opportunityStatus: 'active', opportunityStage: 'lead_qualification',
    nextStep: 'Spec meeting with developer team',
    updatedDate: '2025-04-08', developerCustomerId: 'c10', jobLocation: 'Atlanta, GA',
    bidders: [],
    lastTouchAt: '2025-04-08T10:00:00Z',
  },
  {
    id: 'pr18', customerId: 'c6', name: 'Augusta Federal Building Lobby', status: 'Bidding',
    description: 'Federal building lobby renovation, government spec, GSA-compliant',
    address: '600 Reynolds St, Augusta, GA 30901',
    value: 145000, productIds: ['p4', 'p6'], sampleOrderIds: [],
    notes: [],
    createdDate: '2024-12-01', anticipatedOrderDate: '2025-06-30',
    opportunityId: 'OPP-2024-0455', salesRepId: 'rep-sarah', salesLocationId: '310',
    projectType: 'government', opportunityStatus: 'active', opportunityStage: 'bidding',
    nextStep: 'Submit GSA paperwork',
    updatedDate: '2025-01-10', architecturalFirmId: 'c6', jobLocation: 'Augusta, GA',
    bidders: [],
    lastTouchAt: '2025-01-10T09:00:00Z',  // DORMANT
  },
  {
    id: 'pr19', customerId: 'c1', name: 'Decatur Townhome Cluster', status: 'Lead',
    description: '36 townhomes, LVP throughout common areas + units',
    address: '450 W Trinity Pl, Decatur, GA 30030',
    value: 110000, productIds: ['p1'], sampleOrderIds: [],
    notes: [],
    createdDate: '2024-09-18', anticipatedOrderDate: '2025-10-15',
    opportunityId: 'OPP-2024-0356', salesRepId: 'rep-sarah', salesLocationId: '310',
    projectType: 'multifamily', opportunityStatus: 'active', opportunityStage: 'lead_qualification',
    nextStep: 'Try to re-engage GC',
    updatedDate: '2024-11-04', gcCustomerId: 'c1', jobLocation: 'Decatur, GA',
    bidders: [],
    lastTouchAt: '2024-11-04T13:15:00Z',  // DORMANT
  },
  {
    id: 'pr20', customerId: 'c11', name: 'Sandy Springs Corporate Campus', status: 'Active',
    description: 'New 4-building corporate campus, 240,000 sqft total',
    address: '6100 Lake Forrest Dr, Sandy Springs, GA 30328',
    value: 650000, productIds: ['p1', 'p6', 'p4'], sampleOrderIds: [],
    notes: [],
    createdDate: '2024-12-15', anticipatedOrderDate: '2026-06-01',
    opportunityId: 'OPP-2024-0478', salesRepId: 'rep-sarah', salesLocationId: '310',
    projectType: 'corporate', opportunityStatus: 'active', opportunityStage: 'design',
    nextStep: 'Awaiting architect spec finalization',
    updatedDate: '2025-04-04', architecturalFirmId: 'c8',
    developerCustomerId: 'c11', jobLocation: 'Sandy Springs, GA',
    bidders: [],
    lastTouchAt: '2025-04-04T11:30:00Z',
  },

  // ── Dormant-only opportunities — drive the weekly digest demo ──
  {
    id: 'pr21', customerId: 'c13', name: 'Tucker Corporate Office Park', status: 'Lead',
    description: '4-building suburban office park, ~85,000 sqft total — Pinnacle is architect of record',
    address: '2400 Mountain Industrial Blvd, Tucker, GA 30084',
    value: 185000, productIds: ['p1', 'p6'], sampleOrderIds: [],
    notes: [],
    createdDate: '2024-08-22', anticipatedOrderDate: '2025-10-01',
    opportunityId: 'OPP-2024-0318', salesRepId: 'rep-sarah', salesLocationId: '310',
    projectType: 'corporate', opportunityStatus: 'on_hold', opportunityStage: 'lead_qualification',
    nextStep: 'Re-engage Eli — last spec meeting was September',
    updatedDate: '2024-11-20', architecturalFirmId: 'c13', jobLocation: 'Tucker, GA',
    bidders: [],
    lastTouchAt: '2024-11-20T13:00:00Z',
  },
  {
    id: 'pr22', customerId: 'c14', name: 'Vineyard Coastal Resort Phase II', status: 'Lead',
    description: 'Second-phase expansion — 60 units + spa, hospitality-grade flooring throughout',
    address: '125 Coastal Way, Tybee Island, GA 31328',
    value: 240000, productIds: ['p9', 'p4', 'p3'], sampleOrderIds: [],
    notes: [],
    createdDate: '2024-07-08', anticipatedOrderDate: '2025-12-15',
    opportunityId: 'OPP-2024-0265', salesRepId: 'rep-sarah', salesLocationId: '310',
    projectType: 'hospitality', opportunityStatus: 'on_hold', opportunityStage: 'design',
    nextStep: 'Check timeline with Roberto — financing was pending',
    updatedDate: '2024-10-05', developerCustomerId: 'c14', jobLocation: 'Tybee Island, GA',
    bidders: [],
    lastTouchAt: '2024-10-05T09:30:00Z',
  },
  {
    id: 'pr23', customerId: 'c15', name: 'Sterling R&D Lab Buildout', status: 'Bidding',
    description: 'Pharma R&D facility — antimicrobial vinyl, lab-grade requirements',
    address: '2200 Lake Park Dr, Smyrna, GA 30080',
    value: 95000, productIds: ['p8', 'p6'], sampleOrderIds: [],
    notes: [],
    createdDate: '2024-09-12', anticipatedOrderDate: '2025-08-01',
    opportunityId: 'OPP-2024-0354', salesRepId: 'rep-sarah', salesLocationId: '310',
    projectType: 'healthcare', opportunityStatus: 'on_hold', opportunityStage: 'bidding',
    nextStep: 'Resubmit LVT spec with revised antimicrobial cert',
    updatedDate: '2024-12-08', endUserCustomerId: 'c15', jobLocation: 'Smyrna, GA',
    bidders: [{ id: 'bid-pr23-1', customerId: 'c15', quotedDate: '2024-11-15', quotedAmount: 92000 }],
    lastTouchAt: '2024-12-08T11:00:00Z',
  },
  {
    id: 'pr24', customerId: 'c16', name: 'West Midtown Boutique Residence', status: 'Lead',
    description: 'Custom boutique residence — premium hardwood throughout main living areas',
    address: '930 Brady Ave NW, Atlanta, GA 30318',
    value: 42000, productIds: ['p7', 'p3'], sampleOrderIds: [],
    notes: [],
    createdDate: '2024-08-30', anticipatedOrderDate: '2025-07-01',
    opportunityId: 'OPP-2024-0327', salesRepId: 'rep-sarah', salesLocationId: '310',
    projectType: 'single_family', opportunityStatus: 'on_hold', opportunityStage: 'design',
    nextStep: 'Follow up on revised palette — client was traveling',
    updatedDate: '2024-11-12', architecturalFirmId: 'c16', jobLocation: 'Atlanta, GA',
    bidders: [],
    lastTouchAt: '2024-11-12T15:45:00Z',
  },
  {
    id: 'pr25', customerId: 'c17', name: 'Calhoun Municipal Building', status: 'Bidding',
    description: 'New municipal services building — GSA-grade flooring + carpet, public sector spec',
    address: '320 Court St, Calhoun, GA 30701',
    value: 128000, productIds: ['p4', 'p6', 'p1'], sampleOrderIds: [],
    notes: [],
    createdDate: '2024-07-22', anticipatedOrderDate: '2025-09-30',
    opportunityId: 'OPP-2024-0289', salesRepId: 'rep-sarah', salesLocationId: '310',
    projectType: 'government', opportunityStatus: 'on_hold', opportunityStage: 'bidding',
    nextStep: 'Resubmit public-sector pricing — council reviewed budget Oct 22',
    updatedDate: '2024-10-22', gcCustomerId: 'c17', jobLocation: 'Calhoun, GA',
    bidders: [],
    lastTouchAt: '2024-10-22T10:15:00Z',
  },

  // ── Round-out projects so every primary customer has 2+ opportunities ──
  {
    id: 'pr26', customerId: 'c4', name: 'Kim Floors Buckhead Showroom Build-Out', status: 'Active',
    description: 'New satellite showroom in Buckhead — full Trinity-branded product wall',
    address: '3500 Peachtree Rd NE, Atlanta, GA 30326',
    value: 35000, productIds: ['p1', 'p2', 'p3', 'p4'], sampleOrderIds: [],
    notes: [],
    createdDate: '2026-02-08', anticipatedOrderDate: '2026-07-15',
    opportunityId: 'OPP-2026-0042', salesRepId: 'rep-sarah', salesLocationId: '310',
    projectType: 'retail', opportunityStatus: 'active', opportunityStage: 'design',
    nextStep: 'Finalize display product mix with Sandra by next Friday',
    updatedDate: '2026-04-22', endUserCustomerId: 'c4', jobLocation: 'Atlanta, GA',
    bidders: [],
    lastTouchAt: '2026-04-22T11:00:00Z',
  },
  {
    id: 'pr27', customerId: 'c9', name: 'Tate Marietta Square Showroom Refresh', status: 'Lead',
    description: 'Existing showroom updated with current Trinity SPC + tile collections',
    address: '750 Dallas Hwy, Marietta, GA 30064',
    value: 22500, productIds: ['p2', 'p4', 'p5'], sampleOrderIds: [],
    notes: [],
    createdDate: '2026-03-15', anticipatedOrderDate: '2026-08-01',
    opportunityId: 'OPP-2026-0078', salesRepId: 'rep-sarah', salesLocationId: '310',
    projectType: 'retail', opportunityStatus: 'active', opportunityStage: 'lead_qualification',
    nextStep: 'Schedule walkthrough with Brian — week of May 19',
    updatedDate: '2026-04-25', endUserCustomerId: 'c9', jobLocation: 'Marietta, GA',
    bidders: [],
    lastTouchAt: '2026-04-25T14:30:00Z',
  },
  {
    id: 'pr28', customerId: 'c11', name: 'Midtown Atlanta Spec Tower', status: 'Active',
    description: '38-story Class A office tower, Atlantic Capital developing + self-performing GC',
    address: '1075 W Peachtree St NW, Atlanta, GA 30309',
    value: 420000, productIds: ['p1', 'p4', 'p6'], sampleOrderIds: [],
    notes: [],
    createdDate: '2026-01-22', anticipatedOrderDate: '2026-12-15',
    opportunityId: 'OPP-2026-0019', salesRepId: 'rep-sarah', salesLocationId: '310',
    projectType: 'corporate', opportunityStatus: 'active', opportunityStage: 'bidding',
    nextStep: 'Submit lobby + amenity-floor quote — due May 25',
    updatedDate: '2026-05-08', developerCustomerId: 'c11', gcCustomerId: 'c11',
    architecturalFirmId: 'c8', jobLocation: 'Atlanta, GA',
    bidders: [],
    lastTouchAt: '2026-05-08T09:15:00Z',
  },
  {
    id: 'pr29', customerId: 'c12', name: 'Reilly Highlands Vacation Home', status: 'Active',
    description: '4,200 sqft mountain vacation home — premium hardwood throughout',
    address: '128 Mirror Lake Dr, Highlands, NC 28741',
    value: 48000, productIds: ['p7', 'p3'], sampleOrderIds: [],
    notes: [],
    createdDate: '2026-04-12', anticipatedOrderDate: '2026-09-01',
    opportunityId: 'OPP-2026-0118', salesRepId: 'rep-sarah', salesLocationId: '310',
    projectType: 'single_family', opportunityStatus: 'active', opportunityStage: 'design',
    nextStep: 'Send samples to Marcus — solid oak, stained warm walnut',
    updatedDate: '2026-04-30', endUserCustomerId: 'c12', jobLocation: 'Highlands, NC',
    bidders: [],
    lastTouchAt: '2026-04-30T16:20:00Z',
  },
  {
    id: 'pr30', customerId: 'c12', name: 'Reilly Penthouse Phase II — Lower Floor', status: 'Lead',
    description: 'Continuation of Midtown penthouse — guest suite + media room flooring',
    address: '1065 Peachtree St NE Unit PH, Atlanta, GA 30309',
    value: 28000, productIds: ['p3', 'p9'], sampleOrderIds: [],
    notes: [],
    createdDate: '2026-04-25', anticipatedOrderDate: '2026-10-15',
    opportunityId: 'OPP-2026-0131', salesRepId: 'rep-sarah', salesLocationId: '310',
    projectType: 'single_family', opportunityStatus: 'active', opportunityStage: 'lead_qualification',
    nextStep: 'Confirm scope — Marcus mentioned cork in media room',
    updatedDate: '2026-04-25', architecturalFirmId: 'c2', endUserCustomerId: 'c12',
    jobLocation: 'Atlanta, GA',
    bidders: [],
    lastTouchAt: '2026-04-25T18:45:00Z',
  },
  {
    id: 'pr31', customerId: 'c13', name: 'Buckhead Class A Office Tower', status: 'Bidding',
    description: '24-story office tower — Pinnacle is architect of record',
    address: '3414 Peachtree Rd NE, Atlanta, GA 30326',
    value: 310000, productIds: ['p4', 'p1', 'p6'], sampleOrderIds: [],
    notes: [],
    createdDate: '2026-02-14', anticipatedOrderDate: '2027-02-01',
    opportunityId: 'OPP-2026-0051', salesRepId: 'rep-sarah', salesLocationId: '310',
    projectType: 'corporate', opportunityStatus: 'active', opportunityStage: 'bidding',
    nextStep: 'Submit lobby tile + amenity carpet quote',
    updatedDate: '2026-05-06', architecturalFirmId: 'c13',
    jobLocation: 'Atlanta, GA',
    bidders: [],
    lastTouchAt: '2026-05-06T10:30:00Z',
  },
  {
    id: 'pr32', customerId: 'c14', name: 'Vineyard Tybee Event Center', status: 'Active',
    description: 'New 8,500 sqft event center adjacent to coastal resort',
    address: '110 Tybrisa Blvd, Tybee Island, GA 31328',
    value: 145000, productIds: ['p4', 'p7', 'p9'], sampleOrderIds: [],
    notes: [],
    createdDate: '2026-03-08', anticipatedOrderDate: '2026-11-15',
    opportunityId: 'OPP-2026-0067', salesRepId: 'rep-sarah', salesLocationId: '310',
    projectType: 'hospitality', opportunityStatus: 'active', opportunityStage: 'design',
    nextStep: 'Send hospitality-grade tile samples to Roberto',
    updatedDate: '2026-04-28', developerCustomerId: 'c14',
    jobLocation: 'Tybee Island, GA',
    bidders: [],
    lastTouchAt: '2026-04-28T13:00:00Z',
  },
  {
    id: 'pr33', customerId: 'c15', name: 'Sterling Phase III R&D Expansion', status: 'Lead',
    description: 'Additional 22,000 sqft of lab space — antimicrobial vinyl plus chemical-resistant tile',
    address: '2200 Lake Park Dr, Smyrna, GA 30080',
    value: 138000, productIds: ['p8', 'p4'], sampleOrderIds: [],
    notes: [],
    createdDate: '2026-03-30', anticipatedOrderDate: '2027-01-15',
    opportunityId: 'OPP-2026-0094', salesRepId: 'rep-sarah', salesLocationId: '310',
    projectType: 'healthcare', opportunityStatus: 'active', opportunityStage: 'lead_qualification',
    nextStep: 'Schedule on-site spec review with Priya',
    updatedDate: '2026-05-02', endUserCustomerId: 'c15',
    jobLocation: 'Smyrna, GA',
    bidders: [],
    lastTouchAt: '2026-05-02T11:00:00Z',
  },
  {
    id: 'pr34', customerId: 'c16', name: 'Highline Design Studio Showroom', status: 'Active',
    description: 'Vivienne building out a small showroom adjacent to studio — Trinity featured throughout',
    address: '888 W Marietta St NW, Atlanta, GA 30318',
    value: 22000, productIds: ['p3', 'p9', 'p4'], sampleOrderIds: [],
    notes: [],
    createdDate: '2026-04-10', anticipatedOrderDate: '2026-08-30',
    opportunityId: 'OPP-2026-0112', salesRepId: 'rep-sarah', salesLocationId: '310',
    projectType: 'retail', opportunityStatus: 'active', opportunityStage: 'design',
    nextStep: 'Confirm hardwood color — Viv asked about a darker walnut option',
    updatedDate: '2026-05-05', architecturalFirmId: 'c16', endUserCustomerId: 'c16',
    jobLocation: 'Atlanta, GA',
    bidders: [],
    lastTouchAt: '2026-05-05T15:45:00Z',
  },
  {
    id: 'pr35', customerId: 'c17', name: 'Calhoun Senior Recreation Center', status: 'Bidding',
    description: 'New senior community center — 14,000 sqft, public-sector spec',
    address: '450 N River St, Calhoun, GA 30701',
    value: 85000, productIds: ['p1', 'p6'], sampleOrderIds: [],
    notes: [],
    createdDate: '2026-02-28', anticipatedOrderDate: '2026-10-30',
    opportunityId: 'OPP-2026-0058', salesRepId: 'rep-sarah', salesLocationId: '310',
    projectType: 'community', opportunityStatus: 'active', opportunityStage: 'bidding',
    nextStep: 'Submit pricing per GSA spec — due May 30',
    updatedDate: '2026-05-04', gcCustomerId: 'c17',
    jobLocation: 'Calhoun, GA',
    bidders: [],
    lastTouchAt: '2026-05-04T09:30:00Z',
  },
  {
    id: 'pr36', customerId: 'c1', name: 'Roswell Class A Office Park', status: 'Active',
    description: '4-building office park, Webb leading construction — 220,000 sqft total',
    address: '11455 Sanctuary Blvd, Roswell, GA 30076',
    value: 285000, productIds: ['p1', 'p6', 'p4'], sampleOrderIds: [],
    notes: [],
    createdDate: '2026-01-15', anticipatedOrderDate: '2026-11-30',
    opportunityId: 'OPP-2026-0011', salesRepId: 'rep-sarah', salesLocationId: '310',
    projectType: 'corporate', opportunityStatus: 'active', opportunityStage: 'design',
    nextStep: 'Confirm Webb spec for executive floor — Marcus reviewing options',
    updatedDate: '2026-05-09', gcCustomerId: 'c1', architecturalFirmId: 'c8',
    jobLocation: 'Roswell, GA',
    bidders: [],
    lastTouchAt: '2026-05-09T10:00:00Z',
  },
  {
    id: 'pr37', customerId: 'c3', name: 'Greer Architecture Office Renovation', status: 'Lead',
    description: 'Tom wants to refresh his own office — Trinity gets first look',
    address: '500 Commerce Dr, Marietta, GA 30060',
    value: 48000, productIds: ['p3', 'p4'], sampleOrderIds: [],
    notes: [],
    createdDate: '2026-04-18', anticipatedOrderDate: '2026-09-15',
    opportunityId: 'OPP-2026-0123', salesRepId: 'rep-sarah', salesLocationId: '310',
    projectType: 'corporate', opportunityStatus: 'active', opportunityStage: 'lead_qualification',
    nextStep: 'Send Tom hardwood + tile lookbook',
    updatedDate: '2026-05-01', architecturalFirmId: 'c3', endUserCustomerId: 'c3',
    jobLocation: 'Marietta, GA',
    bidders: [],
    lastTouchAt: '2026-05-01T14:00:00Z',
  },
  {
    id: 'pr38', customerId: 'c8', name: 'Atlanta Mixed-Use Phase II', status: 'Lead',
    description: 'Next phase of the Howell Mill development — 80,000 sqft retail + 200 units',
    address: '1900 Howell Mill Rd NW, Atlanta, GA 30318',
    value: 480000, productIds: ['p1', 'p2', 'p4', 'p6'], sampleOrderIds: [],
    notes: [],
    createdDate: '2026-04-02', anticipatedOrderDate: '2027-04-15',
    opportunityId: 'OPP-2026-0103', salesRepId: 'rep-sarah', salesLocationId: '310',
    projectType: 'mixed_use', opportunityStatus: 'active', opportunityStage: 'lead_qualification',
    nextStep: 'Coordinate spec meeting with Janet — Phase II kickoff late May',
    updatedDate: '2026-05-03', architecturalFirmId: 'c8', developerCustomerId: 'c10',
    jobLocation: 'Atlanta, GA',
    bidders: [],
    lastTouchAt: '2026-05-03T11:30:00Z',
  },
];

// ── SAMPLE ORDERS ─────────────────────────────────────────────
export const seedSampleOrders: SampleOrder[] = [
  {
    id: 'so1', customerId: 'c1', projectId: 'pr1', status: 'Delivered',
    orderedDate: '2025-02-20',
    items: [
      { productId: 'p2', productName: 'BlueSky SPC', privateLabelName: 'Armstrong Vivero Plus', quantity: 2 },
      { productId: 'p4', productName: 'GraniteShield Tile', privateLabelName: 'Daltile Degree', quantity: 3 },
    ],
    shippingName: 'Marcus Webb', shippingAddress: '1200 Peachtree St NE',
    shippingCity: 'Atlanta', shippingState: 'GA', shippingZip: '30309',
    trackingNumber: '1Z999AA10123456784',
  },
  {
    id: 'so2', customerId: 'c2', projectId: 'pr2', status: 'Shipped',
    orderedDate: '2025-03-15',
    items: [
      { productId: 'p3', productName: 'Peachtree Oak EHW', privateLabelName: 'Mohawk TecWood', quantity: 2 },
      { productId: 'p7', productName: 'MapleCrest HW', privateLabelName: 'Bruce Maple Solid', quantity: 1 },
    ],
    shippingName: 'Priya Nair', shippingAddress: '340 Ponce De Leon Ave',
    shippingCity: 'Atlanta', shippingState: 'GA', shippingZip: '30308',
    trackingNumber: '1Z999AA10123456785',
  },
];

// ── EMAILS ────────────────────────────────────────────────────
// Diverse received emails for the email AI demo. Covers every intent the
// auto-draft pipeline classifies: pricing_request, spec_sheet_request,
// scheduling, new_lead, follow_up, dormant_reply, sample_request, general.
// Some senders match existing customers (link to projects in CRM); others
// are new addresses (triggers new-project detection prompt).
export const seedEmails: EmailMessage[] = [
  // ── PRICING REQUESTS (quote-gating demo) ───────────────────
  {
    id: 'e1', folder: 'inbox', isRead: false, isStarred: true,
    from: 'marcus@webbconstruction.com', fromName: 'Marcus Webb',
    to: ['colton@trinitysurfaces.com'],
    subject: 'Re: Buckhead Lobby — SPC approval',
    body: 'Colton,\n\nWe reviewed the BlueSky SPC samples with the developer and got approval. Please send a formal quote for 8,200 sqft, 9"x60" planks, embossed finish, color TBD between Stone Grey and Warm Walnut.\n\nThanks,\nMarcus',
    date: '2025-04-10T09:22:00Z', attachedBrochureIds: [],
  },
  {
    id: 'e2', folder: 'inbox', isRead: false, isStarred: false,
    from: 'beth@staffordbuild.com', fromName: 'Beth Stafford',
    to: ['colton@trinitysurfaces.com'],
    subject: 'Macon Medical — LVT pricing needed',
    body: 'Colton,\n\nNeed pricing on AquaShield LVT for the Macon Medical Office. About 4,800 sqft total. Healthcare spec, so satin finish only. Need by Friday.\n\nBeth',
    date: '2025-04-08T09:15:00Z', attachedBrochureIds: [],
  },
  {
    id: 'e3', folder: 'inbox', isRead: false, isStarred: false,
    from: 'janet@oseiarch.com', fromName: 'Janet Osei',
    to: ['colton@trinitysurfaces.com'],
    subject: 'Mixed-Use Development — flooring RFP',
    body: 'Colton,\n\nWe are issuing an RFP for a 60,000 sqft mixed-use development on Howell Mill. Please submit pricing for LVP, SPC, tile, and commercial carpet by April 25.\n\nDeveloper is Hines Property Group. Architect of record is our firm.\n\nJanet Osei, AIA',
    date: '2025-04-11T08:15:00Z', attachedBrochureIds: [],
  },
  {
    id: 'e4', folder: 'inbox', isRead: false, isStarred: false,
    from: 'alicia@mendezinteriors.com', fromName: 'Alicia Mendez',
    to: ['colton@trinitysurfaces.com'],
    subject: 'Augusta Riverwalk — revised qty',
    body: 'Colton,\n\nThe developer revised unit count up to 132. Need revised pricing for StoneCreek LVP. Same color/finish as the original quote.\n\nAlicia',
    date: '2025-04-09T11:45:00Z', attachedBrochureIds: [],
  },
  {
    id: 'e5', folder: 'inbox', isRead: false, isStarred: true,
    from: 'kpowell@meridianbuild.com', fromName: 'Kevin Powell',
    to: ['colton@trinitysurfaces.com'],
    subject: 'Need pricing — Roswell senior living',
    body: 'Hi,\n\nGot your name from Beth at Stafford. We have a senior living project in Roswell, looking at about 22,000 sqft of LVP for common areas. Can you send pricing?\n\nKevin Powell\nMeridian Construction',
    date: '2025-04-12T14:30:00Z', attachedBrochureIds: [],
  },
  {
    id: 'e6', folder: 'inbox', isRead: false, isStarred: false,
    from: 'pmd@duncanarchitects.com', fromName: 'Patrick Duncan',
    to: ['colton@trinitysurfaces.com'],
    subject: 'Quote request',
    body: 'Need pricing on porcelain tile for a commercial project. About 8,000 sqft.\n\nPatrick Duncan, AIA',
    date: '2025-04-13T10:00:00Z', attachedBrochureIds: [],
  },

  // ── SPEC SHEET / BROCHURE REQUESTS (auto-attach demo) ──────
  {
    id: 'e7', folder: 'inbox', isRead: false, isStarred: false,
    from: 'tom@greerarch.com', fromName: 'Tom Greer',
    to: ['colton@trinitysurfaces.com'],
    subject: 'Need spec sheets — Marietta Office Park',
    body: 'Colton,\n\nCan you send me spec sheets for the StoneCreek LVP and SilverStream Carpet you mentioned? Need them for the submittal package.\n\nTom',
    date: '2025-04-11T15:20:00Z', attachedBrochureIds: [],
  },
  {
    id: 'e8', folder: 'inbox', isRead: false, isStarred: false,
    from: 'lisa@greerarch.com', fromName: 'Lisa Park',
    to: ['colton@trinitysurfaces.com'],
    subject: 'Hardwood brochures please',
    body: "Hi Colton,\n\nI'm working on a high-end residential spec and need your hardwood lookbook plus Mohawk TecWood literature. Can you forward?\n\nThanks,\nLisa Park",
    date: '2025-04-10T16:00:00Z', attachedBrochureIds: [],
  },
  {
    id: 'e9', folder: 'inbox', isRead: false, isStarred: false,
    from: 'janet@oseiarch.com', fromName: 'Janet Osei',
    to: ['colton@trinitysurfaces.com'],
    subject: 'LEED documentation',
    body: 'Colton,\n\nWe need your sustainability/LEED documentation for the mixed-use submittal. Whatever you have for green building credits.\n\nJanet',
    date: '2025-04-12T09:30:00Z', attachedBrochureIds: [],
  },
  {
    id: 'e10', folder: 'inbox', isRead: false, isStarred: false,
    from: 'rmackey@buildersfirst.com', fromName: 'Robert Mackey',
    to: ['colton@trinitysurfaces.com'],
    subject: 'Tile literature',
    body: 'Send me your tile catalog when you get a chance. Working on a hotel ground floor.\n\nRobert',
    date: '2025-04-13T07:45:00Z', attachedBrochureIds: [],
  },

  // ── NEW LEAD / NEW PROJECT MENTIONS (new-project detection) ─
  {
    id: 'e11', folder: 'inbox', isRead: false, isStarred: true,
    from: 'sandra.ng@verityarch.com', fromName: 'Sandra Ng',
    to: ['colton@trinitysurfaces.com'],
    subject: 'New project — Decatur courthouse renovation',
    body: 'Hi Colton,\n\nVerity Architects here. We just landed the Decatur Courthouse renovation — about 35,000 sqft, government spec, GSA-compliant flooring required. Probably tile + commercial carpet. Can we set up a meeting?\n\nSandra Ng',
    date: '2025-04-12T11:00:00Z', attachedBrochureIds: [],
  },
  {
    id: 'e12', folder: 'inbox', isRead: false, isStarred: false,
    from: 'carlos@bonnardco.com', fromName: 'Carlos Bonnard',
    to: ['colton@trinitysurfaces.com'],
    subject: 'Stone Mountain church build',
    body: "Colton,\n\nWe're building a new church campus in Stone Mountain — 28,000 sqft, sanctuary + classrooms + offices. Want to talk about flooring options. The architect is Greer Architecture.\n\nCarlos",
    date: '2025-04-11T13:30:00Z', attachedBrochureIds: [],
  },
  {
    id: 'e13', folder: 'inbox', isRead: false, isStarred: false,
    from: 'mreilly@gmail.com', fromName: 'Marcus Reilly',
    to: ['colton@trinitysurfaces.com'],
    subject: 'My penthouse — second project',
    body: "Colton,\n\nLove what we're doing with the penthouse. We also just bought a vacation place in Highlands NC — about 4,000 sqft. Would you handle that too?\n\nMarcus",
    date: '2025-04-09T18:45:00Z', attachedBrochureIds: [],
  },
  {
    id: 'e14', folder: 'inbox', isRead: false, isStarred: false,
    from: 'estimating@kingsridge.com', fromName: 'Kingsridge Estimating',
    to: ['colton@trinitysurfaces.com'],
    subject: 'RFP: Forsyth multifamily — 240 units',
    body: 'Trinity Surfaces:\n\nKingsridge Builders is bidding the Forsyth Highlands multifamily — 240 units. Please submit pricing for our standard LVP package, see attached spec.\n\nDue April 30. Project value: ~$185k flooring.\n\nKingsridge Estimating Team',
    date: '2025-04-13T08:00:00Z', attachedBrochureIds: [],
  },

  // ── FOLLOW-UPS ON EXISTING PROJECTS ────────────────────────
  {
    id: 'e15', folder: 'inbox', isRead: false, isStarred: false,
    from: 'priya@nairdesign.com', fromName: 'Priya Nair',
    to: ['colton@trinitysurfaces.com'],
    subject: 'Re: Midtown Penthouse — Peachtree Oak feedback',
    body: 'Colton,\n\nMarcus loves the Peachtree Oak. He wants to move forward with the full master bedroom + living area. Send me a quote for 1,400 sqft.\n\nPriya',
    date: '2025-04-08T10:15:00Z', attachedBrochureIds: [],
  },
  {
    id: 'e16', folder: 'inbox', isRead: true, isStarred: false,
    from: 'derek@johnsonreno.com', fromName: 'Derek Johnson',
    to: ['colton@trinitysurfaces.com'],
    subject: 'Re: Savannah Historic — cork question',
    body: 'Colton,\n\nOn the CoastalCork — does it hold up in coastal humidity? Client is asking. Need a yes/no quickly.\n\nDerek',
    date: '2025-04-04T14:00:00Z', attachedBrochureIds: [],
  },
  {
    id: 'e17', folder: 'inbox', isRead: false, isStarred: false,
    from: 'ray@staffordbuild.com', fromName: 'Ray Stafford',
    to: ['colton@trinitysurfaces.com'],
    subject: 'Macon Central High — site walk?',
    body: 'Colton,\n\nCan we get out there next week to walk the building before we lock in product? I have Tuesday or Thursday morning open.\n\nRay',
    date: '2025-04-10T07:30:00Z', attachedBrochureIds: [],
  },
  {
    id: 'e18', folder: 'inbox', isRead: true, isStarred: false,
    from: 'sandra@kimfloors.com', fromName: 'Sandra Kim',
    to: ['colton@trinitysurfaces.com'],
    subject: 'Re: Kim Floors install scheduled',
    body: 'Confirmed for the 15th. Thanks Colton!\n\nSandra',
    date: '2025-04-05T12:00:00Z', attachedBrochureIds: [],
  },

  // ── SCHEDULING / LUNCH & LEARN ─────────────────────────────
  {
    id: 'e19', folder: 'inbox', isRead: false, isStarred: false,
    from: 'janet@oseiarch.com', fromName: 'Janet Osei',
    to: ['colton@trinitysurfaces.com'],
    subject: 'Lunch & learn for our team',
    body: 'Colton,\n\nWe have a new spec team and I want to schedule a lunch & learn. Probably 8-10 people. Can you do mid-May?\n\nJanet',
    date: '2025-04-11T16:30:00Z', attachedBrochureIds: [],
  },
  {
    id: 'e20', folder: 'inbox', isRead: false, isStarred: false,
    from: 'pmorgan@hgaspec.com', fromName: 'Pat Morgan',
    to: ['colton@trinitysurfaces.com'],
    subject: 'Presentation request',
    body: 'Colton,\n\nWe just expanded the firm and have new designers who need exposure to your line. Can you come present? About an hour.\n\nPat Morgan, HGA Spec Division',
    date: '2025-04-12T10:20:00Z', attachedBrochureIds: [],
  },
  {
    id: 'e21', folder: 'inbox', isRead: true, isStarred: false,
    from: 'alicia@mendezinteriors.com', fromName: 'Alicia Mendez',
    to: ['colton@trinitysurfaces.com'],
    subject: 'Showroom visit?',
    body: 'Colton,\n\nWant to come visit the Trinity showroom — what days work?\n\nAlicia',
    date: '2025-04-06T13:00:00Z', attachedBrochureIds: [],
  },

  // ── DORMANT RE-ENGAGEMENT REPLIES ──────────────────────────
  {
    id: 'e22', folder: 'inbox', isRead: false, isStarred: false,
    from: 'tom@greerarch.com', fromName: 'Tom Greer',
    to: ['colton@trinitysurfaces.com'],
    subject: 'Re: Checking in — Cobb Senior Living',
    body: "Colton,\n\nGood to hear from you. We're back on Cobb Senior Living — bidding restarted last week. Can you re-send the LVP pricing? We'll need updated numbers.\n\nTom",
    date: '2025-04-08T08:45:00Z', attachedBrochureIds: [],
  },
  {
    id: 'e23', folder: 'inbox', isRead: false, isStarred: false,
    from: 'janet@oseiarch.com', fromName: 'Janet Osei',
    to: ['colton@trinitysurfaces.com'],
    subject: 'Re: Gwinnett Library — project status',
    body: "Hi Colton,\n\nThanks for checking in. We're moving on the library again — funding came through. Let's reconnect. I'll set up a call next week.\n\nJanet",
    date: '2025-04-10T11:15:00Z', attachedBrochureIds: [],
  },

  // ── SAMPLE REQUESTS ────────────────────────────────────────
  {
    id: 'e24', folder: 'inbox', isRead: false, isStarred: false,
    from: 'tom@greerarch.com', fromName: 'Tom Greer',
    to: ['colton@trinitysurfaces.com'],
    subject: 'Samples — Marietta Office',
    body: 'Colton,\n\nCan you ship 2x12 samples of StoneCreek LVP (all colors) and SilverStream Carpet to my office?\n\nTom',
    date: '2025-04-11T12:00:00Z', attachedBrochureIds: [],
  },
  {
    id: 'e25', folder: 'inbox', isRead: false, isStarred: false,
    from: 'priya@nairdesign.com', fromName: 'Priya Nair',
    to: ['colton@trinitysurfaces.com'],
    subject: 'Need cork samples',
    body: 'Colton,\n\nNeed CoastalCork samples shipped to the boutique hotel project — Inman Park address on file.\n\nPriya',
    date: '2025-04-09T15:30:00Z', attachedBrochureIds: [],
  },
  {
    id: 'e26', folder: 'inbox', isRead: false, isStarred: false,
    from: 'beth@staffordbuild.com', fromName: 'Beth Stafford',
    to: ['colton@trinitysurfaces.com'],
    subject: 'AquaShield samples',
    body: 'Colton,\n\nSend 4 colors of AquaShield LVT to my office. Need them for the Macon Medical submittal.\n\nBeth',
    date: '2025-04-07T09:45:00Z', attachedBrochureIds: [],
  },

  // ── GENERAL INQUIRIES ──────────────────────────────────────
  {
    id: 'e27', folder: 'inbox', isRead: false, isStarred: false,
    from: 'marcus@webbconstruction.com', fromName: 'Marcus Webb',
    to: ['colton@trinitysurfaces.com'],
    subject: 'Question on warranty',
    body: 'Colton,\n\nWhat is the warranty on BlueSky SPC for commercial install? Client is asking.\n\nMarcus',
    date: '2025-04-09T16:20:00Z', attachedBrochureIds: [],
  },
  {
    id: 'e28', folder: 'inbox', isRead: true, isStarred: false,
    from: 'brian@tatefloors.com', fromName: 'Brian Tate',
    to: ['colton@trinitysurfaces.com'],
    subject: 'New product line?',
    body: 'Colton,\n\nDo you have anything new in the SPC line coming this year? Customers keep asking for waterproof options.\n\nBrian',
    date: '2025-04-03T11:00:00Z', attachedBrochureIds: [],
  },
  {
    id: 'e29', folder: 'inbox', isRead: false, isStarred: false,
    from: 'mreilly@gmail.com', fromName: 'Marcus Reilly',
    to: ['colton@trinitysurfaces.com'],
    subject: 'Maintenance question',
    body: "Hi Colton,\n\nOnce the hardwood is in, what's the recommended maintenance routine? Want to make sure we don't damage it.\n\nMarcus",
    date: '2025-04-10T19:30:00Z', attachedBrochureIds: [],
  },
  {
    id: 'e30', folder: 'inbox', isRead: false, isStarred: false,
    from: 'estimating@kingsridge.com', fromName: 'Kingsridge Estimating',
    to: ['colton@trinitysurfaces.com'],
    subject: 'Lead time questions',
    body: "For the upcoming Forsyth bid — what are your typical lead times for 240-unit LVP packages? We're scheduling pour-to-flooring.\n\nKingsridge",
    date: '2025-04-13T09:30:00Z', attachedBrochureIds: [],
  },

  // ── SENT / DRAFTS (existing flow) ──────────────────────────
  {
    id: 'e31', folder: 'sent', isRead: true, isStarred: false,
    from: 'colton@trinitysurfaces.com', fromName: 'Colton P.',
    to: ['priya@nairdesign.com'],
    subject: 'Hardwood samples shipped — Midtown Penthouse',
    body: 'Hi Priya,\n\nYour Peachtree Oak EHW and MapleCrest HW samples shipped today. Tracking: 1Z999AA10123456785.\n\nLet me know if you need anything else!\n\nColton',
    date: '2025-03-15T14:05:00Z', attachedBrochureIds: ['b3'],
  },
  {
    id: 'e32', folder: 'sent', isRead: true, isStarred: false,
    from: 'colton@trinitysurfaces.com', fromName: 'Colton P.',
    to: ['tom@greerarch.com'],
    subject: 'Marietta Office Park — Trinity Commercial Catalog',
    body: "Hi Tom,\n\nGreat to hear from you! I've attached our commercial catalog with StoneCreek LVP and SilverStream Carpet — both strong options for office environments.\n\nHappy to arrange samples.\n\nColton",
    date: '2025-04-02T09:00:00Z', attachedBrochureIds: ['b1', 'b6'],
  },
  {
    id: 'e33', folder: 'sent', isRead: true, isStarred: false,
    from: 'colton@trinitysurfaces.com', fromName: 'Colton P.',
    to: ['marcus@webbconstruction.com'],
    subject: 'Buckhead High-Rise — initial pricing',
    body: 'Hi Marcus,\n\nPer our call, attached is initial pricing for the lobby/corridor SPC. Final qty pending architect sign-off.\n\nColton',
    date: '2025-03-15T10:30:00Z', attachedBrochureIds: ['b1'],
  },
];

// ── PRICE ENTRIES (auto-generated from products × private labels) ──
export const seedPriceEntries: PriceEntry[] = seedProducts.flatMap((product, _pi) =>
  product.privateLabels.map((pl, i) => ({
    id: `pe-${product.id}-${i}`,
    productId: product.id,
    trinityName: product.trinityName,
    trinitySku: product.trinitySku,
    privateLabelBrand: pl.brand,
    privateLabelName: pl.productName,
    privateLabelSku: pl.sku,
    listPrice: pl.listPrice ?? product.listPrice,
    netPrice: pl.netPrice ?? product.netPrice,
    unit: product.unit,
    effectiveDate: '2025-01-01',
  }))
);

// ── DISTRIBUTOR PRICE LISTS ───────────────────────────────────
export const seedDistributorPriceLists: DistributorPriceList[] = [
  {
    id: 'dpl1', distributorName: 'Armstrong World Industries',
    uploadDate: '2025-01-15', effectiveDate: '2025-01-01',
    entries: [
      { id: 'dpl1-1', productName: 'Armstrong Vivero Plus', sku: 'AW-VP-203', category: 'SPC', listPrice: 4.29, dealerPrice: 2.60, unit: 'sq ft' },
      { id: 'dpl1-2', productName: 'Armstrong Prime Harvest', sku: 'AW-PH-188', category: 'Engineered Hardwood', listPrice: 6.00, dealerPrice: 3.70, unit: 'sq ft' },
      { id: 'dpl1-3', productName: 'Armstrong Alterna', sku: 'AW-AL-800', category: 'LVP', listPrice: 3.20, dealerPrice: 1.95, unit: 'sq ft' },
      { id: 'dpl1-4', productName: 'Armstrong Maple Solid', sku: 'AW-MS-325', category: 'Hardwood', listPrice: 7.25, dealerPrice: 4.55, unit: 'sq ft' },
    ],
  },
  {
    id: 'dpl2', distributorName: 'Shaw Industries',
    uploadDate: '2025-02-01', effectiveDate: '2025-01-01',
    entries: [
      { id: 'dpl2-1', productName: 'Shaw Floorte Pro', sku: 'SH-FP-112', category: 'LVP', listPrice: 3.75, dealerPrice: 2.30, unit: 'sq ft' },
      { id: 'dpl2-2', productName: 'Shaw Repel Laminate', sku: 'SH-RL-205', category: 'Laminate', listPrice: 2.75, dealerPrice: 1.65, unit: 'sq ft' },
      { id: 'dpl2-3', productName: 'Shaw Capital III', sku: 'SH-C3-188', category: 'Carpet', listPrice: 2.25, dealerPrice: 1.35, unit: 'sq yd' },
    ],
  },
  {
    id: 'dpl3', distributorName: 'Mohawk Industries',
    uploadDate: '2025-03-01', effectiveDate: '2025-01-01',
    entries: [
      { id: 'dpl3-1', productName: 'Mohawk TecWood', sku: 'MH-TW-301', category: 'Engineered Hardwood', listPrice: 6.20, dealerPrice: 3.90, unit: 'sq ft' },
      { id: 'dpl3-2', productName: 'Mohawk Airo', sku: 'MH-AR-622', category: 'Carpet', listPrice: 2.40, dealerPrice: 1.45, unit: 'sq yd' },
    ],
  },
];

// ── SALES LOCATIONS (foundation slice — production-shaped) ────
export const seedSalesLocations: SalesLocation[] = [
  { id: '310', name: 'Atlanta', region: 'GA', city: 'Atlanta', state: 'GA' },
  { id: '210', name: 'Charlotte', region: 'NC', city: 'Charlotte', state: 'NC' },
  { id: '410', name: 'Savannah', region: 'GA', city: 'Savannah', state: 'GA' },
  { id: '510', name: 'Augusta', region: 'GA', city: 'Augusta', state: 'GA' },
  { id: '610', name: 'Nashville', region: 'TN', city: 'Nashville', state: 'TN' },
];

// ── REPS ──────────────────────────────────────────────────────
// "You" is Colton P. The other reps exist so cross-rep features (GC/sub
// learning, location aggregates) have real data to demo against.
export const seedReps: Rep[] = [
  {
    id: 'rep-sarah', name: 'Colton Plante', initials: 'CP',
    email: 'colton@trinitysurfaces.com', phone: '404-555-9001',
    salesLocationId: '310', isCurrentUser: true,
  },
  {
    id: 'rep-marcus', name: 'Marcus Lee', initials: 'ML',
    email: 'marcus.l@trinitysurfaces.com', phone: '404-555-9002',
    salesLocationId: '310',
  },
  {
    id: 'rep-tonya', name: 'Tonya Brooks', initials: 'TB',
    email: 'tonya@trinitysurfaces.com', phone: '704-555-9003',
    salesLocationId: '210',
  },
  {
    id: 'rep-derek', name: 'Derek Wallace', initials: 'DW',
    email: 'derek@trinitysurfaces.com', phone: '912-555-9004',
    salesLocationId: '410',
  },
  {
    id: 'rep-amy', name: 'Amy Chen', initials: 'AC',
    email: 'amy@trinitysurfaces.com', phone: '615-555-9005',
    salesLocationId: '610',
  },
];

// ── EMAIL THREADS, DRAFTS, ACTIVITIES, EDGES, DIGESTS, QUOTES ──
// Start empty. The email AI pipeline writes threads + drafts on inbox load;
// activities accumulate as the rep works; gcSubEdges populate when quotes
// send; dormantDigests refresh weekly.
export const seedEmailThreads: EmailThread[] = [];
export const seedEmailDrafts: EmailDraft[] = [];
export const seedActivities: Activity[] = [];
// Seeded so the GC↔sub learning view has visible data on first load.
// Real edges accumulate organically as quotes ship (services/quotes.ts logs
// them when a project's gcCustomerId + bidder.awarded line up). These rows
// document Trinity's historical exposure to each major GC's flooring picks.
export const seedGcSubEdges: GcSubEdge[] = [
  // Webb Construction (c1) — leans on Kim Floor + Atlantic Flooring
  { id: 'gse-1',  gcCustomerId: 'c1', subCustomerId: 'c4',  projectId: 'pr-h-1',  wonDate: '2024-06-12', projectValue: 165_000 },
  { id: 'gse-2',  gcCustomerId: 'c1', subCustomerId: 'c4',  projectId: 'pr-h-2',  wonDate: '2024-09-04', projectValue: 220_000 },
  { id: 'gse-3',  gcCustomerId: 'c1', subCustomerId: 'c18', projectId: 'pr-h-3',  wonDate: '2024-11-19', projectValue: 95_000 },
  { id: 'gse-4',  gcCustomerId: 'c1', subCustomerId: 'c9',  projectId: 'pr-h-4',  wonDate: '2024-02-21', projectValue: 48_000 },
  { id: 'gse-5',  gcCustomerId: 'c1', subCustomerId: 'c4',  projectId: 'pr-h-5',  wonDate: '2025-01-14', projectValue: 178_000 },

  // Stafford Commercial Build (c7) — strong relationship with Coastal Surfaces
  { id: 'gse-6',  gcCustomerId: 'c7', subCustomerId: 'c19', projectId: 'pr-h-6',  wonDate: '2024-04-18', projectValue: 78_000 },
  { id: 'gse-7',  gcCustomerId: 'c7', subCustomerId: 'c19', projectId: 'pr-h-7',  wonDate: '2024-08-30', projectValue: 142_000 },
  { id: 'gse-8',  gcCustomerId: 'c7', subCustomerId: 'c18', projectId: 'pr-h-8',  wonDate: '2024-12-05', projectValue: 65_000 },
  { id: 'gse-9',  gcCustomerId: 'c7', subCustomerId: 'c19', projectId: 'pr-h-9',  wonDate: '2025-02-11', projectValue: 92_000 },

  // Hines Property Group (c10) — splits between Piedmont and Kim
  { id: 'gse-10', gcCustomerId: 'c10', subCustomerId: 'c20', projectId: 'pr-h-10', wonDate: '2024-05-30', projectValue: 135_000 },
  { id: 'gse-11', gcCustomerId: 'c10', subCustomerId: 'c20', projectId: 'pr-h-11', wonDate: '2024-10-08', projectValue: 198_000 },
  { id: 'gse-12', gcCustomerId: 'c10', subCustomerId: 'c4',  projectId: 'pr-h-12', wonDate: '2025-03-04', projectValue: 285_000 },

  // Atlantic Capital Developers (c11) — Kim Floor preferred sub
  { id: 'gse-13', gcCustomerId: 'c11', subCustomerId: 'c4',  projectId: 'pr-h-13', wonDate: '2024-07-22', projectValue: 410_000 },
  { id: 'gse-14', gcCustomerId: 'c11', subCustomerId: 'c4',  projectId: 'pr-h-14', wonDate: '2024-11-08', projectValue: 320_000 },
  { id: 'gse-15', gcCustomerId: 'c11', subCustomerId: 'c18', projectId: 'pr-h-15', wonDate: '2025-01-30', projectValue: 105_000 },

  // Johnson Renovations (c5, Savannah) — Coastal Surfaces local play
  { id: 'gse-16', gcCustomerId: 'c5',  subCustomerId: 'c19', projectId: 'pr-h-16', wonDate: '2024-08-15', projectValue: 32_000 },
  { id: 'gse-17', gcCustomerId: 'c5',  subCustomerId: 'c19', projectId: 'pr-h-17', wonDate: '2025-01-09', projectValue: 41_000 },

  // Vineyard Hotel Group (c14, Savannah)
  { id: 'gse-18', gcCustomerId: 'c14', subCustomerId: 'c19', projectId: 'pr-h-18', wonDate: '2024-09-22', projectValue: 188_000 },

  // Calhoun Public Works (c17, public-sector)
  { id: 'gse-19', gcCustomerId: 'c17', subCustomerId: 'c20', projectId: 'pr-h-19', wonDate: '2024-06-04', projectValue: 88_000 },
  { id: 'gse-20', gcCustomerId: 'c17', subCustomerId: 'c20', projectId: 'pr-h-20', wonDate: '2024-12-15', projectValue: 124_000 },
];
export const seedDormantDigests: DormantDigest[] = [];
export const seedQuotes: Quote[] = [];
