#!/usr/bin/env node
/**
 * Sends a fake alert through all configured channels so you can
 * verify your .env is wired up correctly before going live.
 *
 * Usage: node scripts/test-alert.mjs
 */

import { dispatch } from '../src/alerts.mjs';

await dispatch(
  '🚨 TRUMP TRADE SIGNAL [85/100] — ITA, LMT, defense [TEST]',
  [
    'This is a TEST alert from the Trump Trade Scanner.',
    '',
    '"The military is going to be incredible. We are going to rebuild it like never before."',
    '',
    'Tickers/ETFs: ITA, LMT, NOC',
    'Keywords: military, incredible, defense',
    '',
    'If you received this, your alerts are working correctly.',
  ].join('\n')
);

console.log('Test alert sent.');
