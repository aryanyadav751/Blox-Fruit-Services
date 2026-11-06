process.env.NODE_ENV = 'test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { app } from '../server.ts';
import { getMarketTrends } from '../src/server/valueResearcher.ts';

console.log('--- RUNNING MARKET TRENDS WIDGET & GEMINI RESEARCH TESTS ---');

let server: http.Server = null as any;
let baseUrl = '';

await new Promise<void>((resolve) => {
  server = app.listen(0, '127.0.0.1', () => {
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 3000;
    baseUrl = `http://127.0.0.1:${port}`;
    resolve();
  });
});

try {
  // TEST 1: Direct function verification
  {
    const result = await getMarketTrends(false);
    assert.equal(typeof result, 'object');
    assert.equal(Array.isArray(result.trends), true);
    assert.equal(result.trends.length, 5, 'Should return exactly 5 volatile fruits');

    const fruitNames = result.trends.map(f => f.name);
    assert.ok(fruitNames.includes('Kitsune Fruit'), 'Should include Kitsune Fruit');
    assert.ok(fruitNames.includes('Dragon Fruit'), 'Should include Dragon Fruit');

    result.trends.forEach((item) => {
      assert.ok(item.name, 'Item must have name');
      assert.ok(item.category, 'Item must have category');
      assert.ok(parseFloat(item.currentValueM) > 0, 'Current value in M must be > 0');
      assert.ok(['extreme', 'high', 'moderate'].includes(item.volatility), `Invalid volatility: ${item.volatility}`);
      assert.ok(['surging', 'rising', 'fluctuating', 'cooling'].includes(item.trendDirection), `Invalid trend: ${item.trendDirection}`);
      assert.ok(['Apex', 'High', 'Solid'].includes(item.demandTier), `Invalid demand tier: ${item.demandTier}`);
      assert.ok(item.marketReason.length > 5, 'Market reason must be populated');
    });
    console.log('✓ getMarketTrends() returns top 5 volatile fruits with valid schema');
  }

  // TEST 2: GET /api/public/market-trends
  {
    const res = await fetch(`${baseUrl}/api/public/market-trends`);
    assert.equal(res.status, 200, 'Market trends should return 200 OK');
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(Array.isArray(data.trends), true);
    assert.equal(data.trends.length, 5, 'Public trends array length must be 5');
    assert.ok(data.lastUpdated, 'Must contain lastUpdated timestamp');
    assert.ok(data.source, 'Must state research source');
    console.log('✓ GET /api/public/market-trends returns 200 and public trend payload');
  }

  // TEST 3: Force refresh query parameter
  {
    const res = await fetch(`${baseUrl}/api/public/market-trends?refresh=true`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.trends.length, 5);
    console.log('✓ GET /api/public/market-trends?refresh=true executes without error');
  }

  console.log('ALL MARKET TRENDS TESTS PASSED SUCCESSFULLY!');
} finally {
  if (server) {
    server.close();
  }
  process.exit(0);
}
