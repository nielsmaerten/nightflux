import 'dotenv/config';
import { describe, expect, it } from 'vitest';
import NsClient from './nightscout';

describe('Nightscout Client', () => {
  it('returns a reusable Nightscout Axios Instance', () => {
    const nsClient = new NsClient();
    expect(nsClient).toBeInstanceOf(NsClient);
  });
  it('runs a query against Nightscout', async () => {
    const nsClient = new NsClient();
    const result = await nsClient.query('/api/v1/entries.json?count=1');
    expect(result).toBeDefined();
  });
});
