import { jest } from '@jest/globals';
import fetch from 'node-fetch';

const API_BASE = 'https://api.peviitor.ro/v1';

let HAS_API = false;

async function checkApiAvailability() {
  try {
    const res = await fetch(`${API_BASE}/scraper/jobs/?cif=${companyConfig.id}&rows=1`, {
      signal: AbortSignal.timeout(5000)
    });
    return res.ok || res.status === 400;
  } catch {
    return false;
  }
}

let HAS_ANAF = false;

async function checkAnafAvailability() {
  try {
    const res = await fetch('https://demoanaf.ro/api/search?q=test', {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000)
    });
    return res.ok;
  } catch {
    return false;
  }
}

function itIfApi(name, fn, timeout) {
  if (HAS_API) {
    return it(name, fn, timeout);
  }
  return it.skip(`${name} (skipped: API unavailable)`, fn, timeout);
}

function itIfAnaf(name, fn, timeout) {
  if (HAS_ANAF) {
    return it(name, fn, timeout);
  }
  return it.skip(`${name} (skipped: ANAF API unavailable)`, fn, timeout);
}

import companyConfig from '../../scraper/config/company.js';
import scraperConfig from '../../scraper/config/scraper.js';
const TEST_CIF = companyConfig.id;
const TEST_BRAND = companyConfig.brand;
const COMPANY_NAME = companyConfig.company;
const ANOFM_URL = `${scraperConfig.apiBase}${scraperConfig.apiListPath}`;

async function fetchAnofmJobs() {
  const res = await fetch(ANOFM_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Referer': scraperConfig.apiBase,
      'User-Agent': 'job_seeker_ro_spider'
    },
    body: JSON.stringify({
      current: 1,
      rowCount: 50,
      sort: { created_at: "desc" },
      employer_tax_code: TEST_CIF
    })
  });
  return res;
}

beforeAll(async () => {
  [HAS_API, HAS_ANAF] = await Promise.all([checkApiAvailability(), checkAnafAvailability()]);
});

describe('E2E: Full Scraping Pipeline', () => {

  describe('ANOFM — Real Data Fetch', () => {
    let anofmData;

    beforeAll(async () => {
      const res = await fetchAnofmJobs();
      anofmData = await res.json();
    }, 15000);

    it('should respond with valid JSON containing rows', () => {
      expect(anofmData).toBeDefined();
      expect(Array.isArray(anofmData.rows)).toBe(true);
    });

    it('should contain job links when jobs exist', () => {
      if (anofmData.rows.length === 0) {
        console.log('⚠️ No ANOFM jobs for GUSTURI DIVINE — skipping job link assertion');
        return;
      }
      const first = anofmData.rows[0];
      expect(first.id).toBeDefined();
      expect(first.occupation).toBeDefined();
    });
  });

  describe('Parse + Transform Pipeline', () => {
    let index;
    let anofmData;

    beforeAll(async () => {
      index = await import('../../scraper/index.js');
      const res = await fetchAnofmJobs();
      anofmData = await res.json();
    }, 15000);

    it('should parse real ANOFM data into standardized format', () => {
      const jobs = [];
      for (const row of anofmData.rows || []) {
        const locationParts = (row.address_locality_name || '').split('>').map(s => s.trim());
        const location = locationParts.length > 1 ? locationParts[locationParts.length - 1] : locationParts[0];
        jobs.push({
          url: `https://mediere.anofm.ro/app/module/mediere/job/${row.id}`,
          title: row.occupation,
          location: location ? [location] : undefined,
          source: "ANOFM"
        });
      }

      expect(Array.isArray(jobs)).toBe(true);

      if (jobs.length === 0) {
        console.log('⚠️ No ANOFM jobs — skipping job shape assertions');
        return;
      }

      const parsed = jobs[0];
      expect(parsed).toHaveProperty('url');
      expect(parsed.url).toMatch(/^https:\/\/mediere\.anofm\.ro\//);
      expect(parsed).toHaveProperty('title');
      expect(parsed).toHaveProperty('location');
      expect(Array.isArray(parsed.location)).toBe(true);
    });

    it('should map parsed jobs to job model', () => {
      const jobs = [];
      for (const row of anofmData.rows || []) {
        const locationParts = (row.address_locality_name || '').split('>').map(s => s.trim());
        const location = locationParts.length > 1 ? locationParts[locationParts.length - 1] : locationParts[0];
        jobs.push({
          url: `https://mediere.anofm.ro/app/module/mediere/job/${row.id}`,
          title: row.occupation,
          location: location ? [location] : undefined
        });
      }

      if (jobs.length === 0) {
        console.log('⚠️ No ANOFM jobs — skipping job model assertion');
        return;
      }

      const model = index.mapToJobModel(jobs[0], TEST_CIF);

      expect(model).toHaveProperty('url');
      expect(model).toHaveProperty('title');
      expect(model).toHaveProperty('company');
      expect(model).toHaveProperty('cif', TEST_CIF);
      expect(model).toHaveProperty('status', 'scraped');
      expect(model).toHaveProperty('date');
      expect(model.url).toMatch(/^https:\/\/mediere\.anofm\.ro\//);
    });

    it('should transform jobs and filter to Romanian locations', () => {
      const jobs = [];
      for (const row of anofmData.rows || []) {
        const locationParts = (row.address_locality_name || '').split('>').map(s => s.trim());
        const location = locationParts.length > 1 ? locationParts[locationParts.length - 1] : locationParts[0];
        jobs.push({
          url: `https://mediere.anofm.ro/app/module/mediere/job/${row.id}`,
          title: row.occupation,
          location: location ? [location] : undefined
        });
      }

      const parsedJobs = jobs.map(j => index.mapToJobModel(j, TEST_CIF));

      const payload = {
        source: 'anofm.ro',
        company: COMPANY_NAME,
        cif: TEST_CIF,
        jobs: parsedJobs
      };

      const transformed = index.transformJobsForSOLR(payload);

      expect(transformed.company).toBe(COMPANY_NAME);
      expect(transformed.jobs.length).toBe(jobs.length);

      for (const job of transformed.jobs) {
        expect(job).toHaveProperty('location');
        expect(Array.isArray(job.location)).toBe(true);
        expect(job.location.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Company Validation Path', () => {
    let anaf;
    let company;

    beforeAll(async () => {
      anaf = await import('../../scraper/anaf.js');
      company = await import('../../scraper/company.js');
    });

    itIfAnaf('should find GUSTURI DIVINE in ANAF and validate active status', async () => {
      const results = await anaf.searchCompany(TEST_BRAND);

      const gusturi = results.find(c =>
        c.cui.toString() === TEST_CIF &&
        c.statusLabel === 'Funcțiune'
      );
      expect(gusturi).toBeDefined();
      expect(gusturi.cui.toString()).toBe(TEST_CIF);
    }, 30000);

    itIfAnaf('should fetch active company data from ANAF', async () => {
      const anafData = await anaf.getCompanyFromANAF(TEST_CIF);
      expect(anafData).toBeDefined();
      expect(anafData.inactive).toBe(false);
    }, 30000);

    itIfApi('should run full validation and report active status with job count', async () => {
      const result = await company.validateAndGetCompany();

      expect(result.status).toBe('active');
      expect(result.company).toBe(COMPANY_NAME);
      expect(result.cif).toBe(TEST_CIF);

      if (result.existingJobsCount === 0) {
        console.log('⚠️ No GUSTURI DIVINE jobs in API — skipping job count assertion');
        return;
      }
      expect(result.existingJobsCount).toBeGreaterThan(0);
    }, 30000);
  });

  describe('Inactive Company Handling', () => {
    let anaf;

    beforeAll(async () => {
      anaf = await import('../../scraper/anaf.js');
    });

    itIfAnaf('should detect inactive/radiated companies via ANAF', async () => {
      const results = await anaf.searchCompany(TEST_BRAND);

      const nonActive = results.find(c => c.statusLabel !== 'Funcțiune');

      if (nonActive) {
        try {
          const anafData = await anaf.getCompanyFromANAF(nonActive.cui.toString());
          expect(anafData).toBeDefined();
          if (anafData.inactive !== undefined) {
            expect(anafData.inactive).toBe(true);
          }
        } catch {
          expect(nonActive.statusLabel).toMatch(/Radiată|Inactiv|Suspendat/);
        }
      }
    }, 30000);
  });

  describe('API Data Verification', () => {
    let api;

    beforeAll(async () => {
      api = await import('../../scraper/api.js');
    });

    itIfApi('should have GUSTURI DIVINE jobs in API with correct company name', async () => {
      const result = await api.querySOLR(TEST_CIF);

      if (result.numFound === 0) {
        console.log('⚠️ No GUSTURI DIVINE jobs in API — skipping API data verification');
        return;
      }

      for (const job of result.docs) {
        expect(job.company).toBe(COMPANY_NAME);
        expect(job.cif).toBe(TEST_CIF);
      }
    }, 15000);

    itIfApi('should have GUSTURI DIVINE company core entry with required fields', async () => {
      const companyDoc = await api.getCompanyByCif(TEST_CIF);

      expect(companyDoc).toBeDefined();
      expect(companyDoc.company).toBe(COMPANY_NAME);
      expect(companyDoc.status).toBe('activ');
    }, 15000);
  });
});
