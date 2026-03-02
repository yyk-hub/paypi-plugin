// lib/stellar-init.js
/**
 * Stellar SDK Initialization for Cloudflare Workers/Pages
 * 
 * CRITICAL: This MUST be imported before any Stellar SDK usage
 * 
 * Why: Stellar SDK uses axios internally, which doesn't work in CF Workers.
 * Solution: Override axios adapter to use fetch (which is available in CF Workers)
 */

import { Horizon } from '@stellar/stellar-sdk';
import fetchAdapter from '@vespaiach/axios-fetch-adapter';

// Override axios adapter to use fetch
Horizon.AxiosClient.defaults.adapter = fetchAdapter;

console.log('✅ Stellar SDK initialized for Cloudflare Workers (using fetch adapter)');

export { Horizon };