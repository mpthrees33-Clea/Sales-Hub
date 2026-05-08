import type {
  Customer, Product, Brochure, Catalog,
  Project, SampleOrder, EmailMessage,
  PriceEntry, DistributorPriceList,
} from '../types';

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
export const seedProjects: Project[] = [
  {
    id: 'pr1', customerId: 'c1', name: 'Buckhead High-Rise Lobby', status: 'Active',
    description: 'Full lobby and corridor flooring for 24-story luxury residential tower',
    address: '2800 Peachtree Rd NE, Atlanta, GA 30305',
    value: 185000, productIds: ['p2', 'p4'], sampleOrderIds: ['so1'],
    notes: [{ id: 'n1', date: '2025-03-01', text: 'Client approved SPC samples', author: 'Sarah T.' }],
    createdDate: '2025-02-15', anticipatedOrderDate: '2025-05-01',
  },
  {
    id: 'pr2', customerId: 'c2', name: 'Midtown Penthouse Renovation', status: 'Bidding',
    description: 'Full-floor renovation of penthouse unit with premium engineered hardwood',
    address: '1065 Peachtree St NE Unit PH, Atlanta, GA 30309',
    value: 42000, productIds: ['p3', 'p7'], sampleOrderIds: ['so2'],
    notes: [],
    createdDate: '2025-03-10', anticipatedOrderDate: '2025-06-15',
  },
  {
    id: 'pr3', customerId: 'c3', name: 'Marietta Office Park', status: 'Lead',
    description: 'New commercial office park, 18,000 sqft, common areas and suites',
    address: '400 Franklin Gateway SE, Marietta, GA 30067',
    value: 95000, productIds: ['p1', 'p6'], sampleOrderIds: [],
    notes: [],
    createdDate: '2025-04-01', anticipatedOrderDate: '2025-08-01',
  },
  {
    id: 'pr4', customerId: 'c4', name: 'Kim Floors Showroom Remodel', status: 'Won',
    description: 'Showroom floor demo with Trinity products to show end customers',
    address: '88 Northside Dr, Atlanta, GA 30318',
    value: 12500, productIds: ['p1', 'p2', 'p3', 'p4', 'p5'], sampleOrderIds: [],
    notes: [{ id: 'n2', date: '2025-02-01', text: 'PO received, scheduling install', author: 'Sarah T.' }],
    createdDate: '2025-01-20', anticipatedOrderDate: '2025-03-01', closingDate: '2025-03-28',
  },
  {
    id: 'pr5', customerId: 'c5', name: 'Savannah Historic Renovation', status: 'Active',
    description: 'Restoration of historic downtown property with cork and hardwood',
    address: '125 E Bay St, Savannah, GA 31401',
    value: 28000, productIds: ['p9', 'p7'], sampleOrderIds: [],
    notes: [],
    createdDate: '2025-03-20', anticipatedOrderDate: '2025-06-01',
  },
  {
    id: 'pr6', customerId: 'c7', name: 'Macon Medical Office Build', status: 'Bidding',
    description: 'Medical office LVT installation, healthcare spec requirements',
    address: '600 Professional Blvd, Macon, GA 31210',
    value: 67000, productIds: ['p8', 'p6'], sampleOrderIds: [],
    notes: [],
    createdDate: '2025-04-05', anticipatedOrderDate: '2025-07-15',
  },
  {
    id: 'pr7', customerId: 'c8', name: 'Atlanta Mixed-Use Development', status: 'Lead',
    description: '60,000 sqft mixed-use retail and residential, full flooring package',
    address: '1800 Howell Mill Rd NW, Atlanta, GA 30318',
    value: 310000, productIds: ['p1', 'p2', 'p4', 'p6'], sampleOrderIds: [],
    notes: [],
    createdDate: '2025-04-10', anticipatedOrderDate: '2026-01-01',
  },
  {
    id: 'pr8', customerId: 'c10', name: 'Howell Mill Townhomes', status: 'Lost',
    description: '24-unit townhome development, LVP throughout',
    address: '1700 Howell Mill Rd NW, Atlanta, GA 30318',
    value: 54000, productIds: ['p1'], sampleOrderIds: [],
    notes: [{ id: 'n3', date: '2025-02-28', text: 'Lost to competitor — price gap', author: 'Sarah T.' }],
    createdDate: '2025-01-15', anticipatedOrderDate: '2025-04-01', closingDate: '2025-03-01',
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
export const seedEmails: EmailMessage[] = [
  {
    id: 'e1', folder: 'inbox', isRead: false, isStarred: true,
    from: 'marcus@webbconstruction.com', fromName: 'Marcus Webb',
    to: ['sarah@trinitysurfaces.com'],
    subject: 'Re: Buckhead Lobby — SPC approval',
    body: 'Sarah,\n\nWe reviewed the BlueSky SPC samples with the developer and got approval. Please send a formal quote for 8,200 sqft.\n\nThanks,\nMarcus',
    date: '2025-04-10T09:22:00Z', attachedBrochureIds: [],
  },
  {
    id: 'e2', folder: 'sent', isRead: true, isStarred: false,
    from: 'sarah@trinitysurfaces.com', fromName: 'Sarah T.',
    to: ['priya@nairdesign.com'],
    subject: 'Hardwood samples shipped — Midtown Penthouse',
    body: 'Hi Priya,\n\nYour Peachtree Oak EHW and MapleCrest HW samples shipped today. Tracking: 1Z999AA10123456785.\n\nLet me know if you need anything else!\n\nSarah',
    date: '2025-03-15T14:05:00Z', attachedBrochureIds: ['b3'],
  },
  {
    id: 'e3', folder: 'inbox', isRead: true, isStarred: false,
    from: 'tom@greerarch.com', fromName: 'Tom Greer',
    to: ['sarah@trinitysurfaces.com'],
    subject: 'Marietta Office Park — initial inquiry',
    body: 'Sarah,\n\nWe have a new commercial project in Marietta — 18,000 sqft. Looking for commercial LVP and carpet options. Can you send your commercial catalog?\n\nTom',
    date: '2025-04-01T10:30:00Z', attachedBrochureIds: [],
  },
  {
    id: 'e4', folder: 'drafts', isRead: true, isStarred: false,
    from: 'sarah@trinitysurfaces.com', fromName: 'Sarah T.',
    to: ['tom@greerarch.com'],
    subject: 'Marietta Office Park — Trinity Commercial Catalog',
    body: "Hi Tom,\n\nGreat to hear from you! I've attached our commercial catalog with StoneCreek LVP and SilverStream Carpet — both strong options for office environments.\n\nHappy to arrange samples.\n\nSarah",
    date: '2025-04-02T09:00:00Z', attachedBrochureIds: ['b1', 'b6'],
  },
  {
    id: 'e5', folder: 'inbox', isRead: false, isStarred: false,
    from: 'janet@oseiarch.com', fromName: 'Janet Osei',
    to: ['sarah@trinitysurfaces.com'],
    subject: 'Mixed-Use Development — flooring RFP',
    body: 'Sarah,\n\nWe are issuing an RFP for a 60,000 sqft mixed-use development on Howell Mill. Please submit pricing for LVP, SPC, tile, and commercial carpet by April 25.\n\nJanet Osei, AIA',
    date: '2025-04-11T08:15:00Z', attachedBrochureIds: [],
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
