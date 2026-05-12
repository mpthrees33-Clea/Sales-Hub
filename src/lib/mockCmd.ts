import type { ProjectType } from '../types';

// Mock ConstructConnect (CMD) lookup. The real CMD API is paid + requires a
// backend proxy (the credentials can't sit in the frontend), so for the
// demo we generate plausible project data from a hash of the CMD ID — same
// ID always returns the same data, different IDs return different but
// realistic-looking projects.
//
// When the real API lands, swap the body of `lookupCmdProject` to fetch
// against a backend endpoint that proxies the CMD calls. Everything else
// (UI, type shape, "Apply to project" flow) stays the same.

export interface CmdProjectData {
  cmdProjectId: string;
  projectName: string;
  jobLocation: string;
  estimatedValue: number;
  anticipatedOrderDate: string;        // ISO date
  architectName: string;
  gcName: string;
  developerName: string;
  scopeSummary: string;
  projectType: ProjectType;
}

const ARCHITECTS = [
  'HKS Architects', 'Cooper Carry', 'Perkins & Will', 'Niles Bolton Associates',
  'TVS Design', 'Smallwood Reynolds', 'Wakefield Beasley', 'Gensler Atlanta',
  'Lord Aeck Sargent', 'Robertson Loia Roof', 'Foster + Partners Atlanta',
];

const GCS = [
  'Holder Construction', 'Brasfield & Gorrie', 'Whiting-Turner', 'Skanska USA',
  'JE Dunn Construction', 'Choate Construction', 'New South Construction',
  'Hardin Construction', 'Hoar Construction', 'Batson-Cook',
];

const DEVELOPERS = [
  'Hines Atlanta', 'Pope & Land Enterprises', 'Crescent Communities',
  'Cousins Properties', 'Wood Partners', 'Selig Enterprises',
  'North American Properties', 'Carter USA', 'Portman Holdings',
  'Trammell Crow Company',
];

const LOCATIONS_BY_TYPE: Partial<Record<ProjectType, string[]>> = {
  multifamily: ['Atlanta, GA', 'Sandy Springs, GA', 'Marietta, GA', 'Decatur, GA', 'Roswell, GA', 'Alpharetta, GA'],
  corporate: ['Atlanta, GA', 'Sandy Springs, GA', 'Dunwoody, GA', 'Norcross, GA', 'Buckhead, GA'],
  healthcare: ['Atlanta, GA', 'Macon, GA', 'Augusta, GA', 'Athens, GA', 'Marietta, GA'],
  hospitality: ['Savannah, GA', 'Tybee Island, GA', 'Atlanta, GA', 'Sea Island, GA', 'Helen, GA'],
  government: ['Atlanta, GA', 'Athens, GA', 'Augusta, GA', 'Macon, GA', 'Columbus, GA', 'Calhoun, GA'],
  mixed_use: ['Atlanta, GA', 'Avalon, GA', 'Atlantic Station, GA', 'Sandy Springs, GA'],
  retail: ['Atlanta, GA', 'Buckhead, GA', 'Lenox Square, GA', 'Avalon, GA'],
  education: ['Atlanta, GA', 'Athens, GA', 'Macon, GA', 'Decatur, GA'],
  industrial: ['Atlanta, GA', 'Fairburn, GA', 'McDonough, GA', 'Locust Grove, GA'],
  single_family: ['Atlanta, GA', 'Buckhead, GA', 'Sandy Springs, GA', 'Roswell, GA'],
  community: ['Atlanta, GA', 'Marietta, GA', 'Decatur, GA', 'Lawrenceville, GA'],
};

const PROJECT_TYPES: ProjectType[] = [
  'multifamily', 'corporate', 'healthcare', 'hospitality',
  'government', 'mixed_use', 'retail', 'education',
];

const NAME_TEMPLATES_BY_TYPE: Partial<Record<ProjectType, string[]>> = {
  multifamily: ['{Place} Residences', '{Place} Lofts', '{Place} Townhomes Phase {N}', 'The {Place}', '{Place} Apartments'],
  corporate: ['{Place} Corporate Campus', '{Place} Office Tower', '{Place} Class A Office', '{Place} HQ Renovation'],
  healthcare: ['{Place} Medical Center', '{Place} Surgery Center', '{Place} Outpatient Clinic'],
  hospitality: ['{Place} Hotel', '{Place} Resort Phase {N}', '{Place} Boutique Hotel', '{Place} Conference Center'],
  government: ['{Place} Federal Building', '{Place} Municipal Center', '{Place} Public Works'],
  mixed_use: ['{Place} Mixed-Use Development', '{Place} Town Center', '{Place} Marketplace'],
  retail: ['{Place} Marketplace', '{Place} Lifestyle Center', '{Place} Boutique Mall'],
  education: ['{Place} High School', '{Place} Elementary Renovation', '{Place} University Library'],
};

const PLACES = [
  'Riverside', 'North Point', 'Highland', 'Westview', 'Eastfield', 'Stonebridge',
  'Maple Grove', 'Lakeside', 'Bridgewater', 'Greystone', 'Oakhill', 'Pinecrest',
  'Brookhaven', 'Cedarwood', 'Ashford', 'Wellington',
];

// Deterministic 32-bit string hash (djb2 variant). Same input → same output.
function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function pick<T>(arr: T[], n: number): T {
  return arr[n % arr.length];
}

function valueRangeFor(type: ProjectType): [number, number] {
  switch (type) {
    case 'multifamily':   return [125_000, 480_000];
    case 'corporate':     return [180_000, 650_000];
    case 'healthcare':    return [85_000,  220_000];
    case 'hospitality':   return [75_000,  280_000];
    case 'government':    return [95_000,  240_000];
    case 'mixed_use':     return [220_000, 720_000];
    case 'retail':        return [40_000,  140_000];
    case 'education':     return [55_000,  175_000];
    case 'industrial':    return [60_000,  220_000];
    case 'single_family': return [18_000,  85_000];
    case 'community':     return [70_000,  180_000];
    default:              return [40_000,  150_000];
  }
}

function scopeSummaryFor(type: ProjectType): string {
  switch (type) {
    case 'multifamily':   return 'LVP throughout common areas + corridors, carpet in unit interiors. Commercial-grade.';
    case 'corporate':     return 'Lobby + amenity-floor flooring package, mix of porcelain tile and commercial carpet.';
    case 'healthcare':    return 'Healthcare-grade LVT and antimicrobial flooring, HCAI / state compliance required.';
    case 'hospitality':   return 'Mix of hardwood, cork in suites, porcelain tile in lobby + spa areas.';
    case 'government':    return 'GSA-compliant flooring, mix of tile + commercial carpet, public-sector spec.';
    case 'mixed_use':     return 'Retail + residential package — LVP, SPC, tile, commercial carpet across ground floor + units.';
    case 'retail':        return 'Polished tile in showroom floor, LVP in support areas.';
    case 'education':     return 'Heavy-commercial LVT in classrooms + corridors, sheet goods in cafeteria.';
    case 'industrial':    return 'Coated concrete plus heavy-duty LVT in office areas.';
    case 'single_family': return 'Premium engineered hardwood throughout main living, tile in wet areas.';
    case 'community':     return 'Common-area flooring package — LVP + commercial carpet.';
    default:              return 'Mixed flooring scope — see CMD record for full spec.';
  }
}

// 6–18 months out, deterministic from the hash.
function anticipatedDateFor(hash: number): string {
  const monthsOut = 6 + (hash % 13); // 6..18
  const d = new Date();
  d.setMonth(d.getMonth() + monthsOut);
  d.setDate(1 + (hash % 27));
  return d.toISOString().slice(0, 10);
}

export function lookupCmdProject(cmdId: string): CmdProjectData | undefined {
  const trimmed = cmdId.trim();
  if (!trimmed) return undefined;
  const hash = hashString(trimmed.toLowerCase());

  const type = pick(PROJECT_TYPES, hash);
  const place = pick(PLACES, Math.floor(hash / 7));
  const templates = NAME_TEMPLATES_BY_TYPE[type] ?? ['{Place} Project'];
  const template = pick(templates, Math.floor(hash / 11));
  const phaseN = ((hash % 3) + 2).toString(); // II / III / IV
  const projectName = template.replace('{Place}', place).replace('{N}', phaseN);

  const locations = LOCATIONS_BY_TYPE[type] ?? ['Atlanta, GA'];
  const jobLocation = pick(locations, Math.floor(hash / 13));

  const [lo, hi] = valueRangeFor(type);
  // 5k increments inside the band, deterministic
  const steps = Math.floor((hi - lo) / 5000);
  const estimatedValue = lo + (hash % (steps + 1)) * 5000;

  const architectName = pick(ARCHITECTS, Math.floor(hash / 3));
  const gcName        = pick(GCS,        Math.floor(hash / 5));
  const developerName = pick(DEVELOPERS, Math.floor(hash / 17));

  return {
    cmdProjectId: trimmed,
    projectName,
    jobLocation,
    estimatedValue,
    anticipatedOrderDate: anticipatedDateFor(hash),
    architectName,
    gcName,
    developerName,
    scopeSummary: scopeSummaryFor(type),
    projectType: type,
  };
}
