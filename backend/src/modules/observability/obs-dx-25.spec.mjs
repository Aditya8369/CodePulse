import assert from 'node:assert/strict';
import { PrComplexityRatingBotService } from './obs-dx-25.service.ts';

const bot = new PrComplexityRatingBotService();

const cleanCode = `
function calculateSum(a, b) {
  return a + b;
}
`;
const simpleRes = bot.calculateCognitiveComplexity(cleanCode);
assert.strictEqual(simpleRes.score, 0);
assert.strictEqual(simpleRes.rating, 'LOW');

const complexCode = `
function processOrders(orders) {
  for (let order of orders) {
    if (order.isActive && order.items.length > 0) {
      for (let item of order.items) {
        if (item.inStock || item.isPreOrder) {
          if (item.price > 100) {
            order.applyDiscount();
          }
        }
      }
    }
  }
}
`;
const complexRes = bot.calculateCognitiveComplexity(complexCode);
assert.ok(complexRes.score > 5);
assert.strictEqual(complexRes.rating === 'MODERATE' || complexRes.rating === 'HIGH', true);

const diffAnalysis = bot.analyzeCodeDiff(complexCode);
assert.strictEqual(diffAnalysis.functions.length, 1);
const comment = bot.generateReviewComment(diffAnalysis);
assert.ok(comment.includes('PR Code Cognitive Complexity Report'));

console.log('Issue #3205 [OBS-DX-25] spec passed successfully.');
