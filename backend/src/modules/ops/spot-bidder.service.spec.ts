import { Test, TestingModule } from '@nestjs/testing';
import { SpotBidderService } from './spot-bidder.service';

describe('SpotBidderService', () => {
  let service: SpotBidderService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SpotBidderService],
    }).compile();

    service = module.get<SpotBidderService>(SpotBidderService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('fetchSpotPrices', () => {
    it('should retrieve spot pricing across AWS, GCP, HETZNER, and AZURE', async () => {
      const candidates = await service.fetchSpotPrices();
      expect(candidates.length).toBeGreaterThanOrEqual(4);

      const awsCandidate = candidates.find((c) => c.provider === 'AWS');
      expect(awsCandidate).toBeDefined();
      expect(awsCandidate?.discountPercent).toBeGreaterThan(65);
    });

    it('should filter spot prices by specific cloud provider', async () => {
      const gcpCandidates = await service.fetchSpotPrices('GCP');
      expect(gcpCandidates.every((c) => c.provider === 'GCP')).toBe(true);
      expect(gcpCandidates.length).toBeGreaterThan(0);
    });
  });

  describe('evaluateBestBids', () => {
    it('should filter out high interruption risk and require >= 65% discount', () => {
      const bestBids = service.evaluateBestBids(5);
      expect(bestBids.length).toBeGreaterThan(0);
      expect(bestBids.every((b) => b.interruptionRisk !== 'HIGH')).toBe(true);
      expect(bestBids.every((b) => b.discountPercent >= 65.0)).toBe(true);
    });

    it('should enforce price caps when provided', () => {
      const capped = service.evaluateBestBids(5, 0.05);
      expect(capped.every((b) => b.spotPricePerHour <= 0.05)).toBe(true);
    });
  });

  describe('placeSpotBid & IaC Spec Generation', () => {
    it('should place bid and generate Terraform HCL spec', async () => {
      const candidates = await service.fetchSpotPrices('AWS');
      const bid = await service.placeSpotBid(candidates[0], 4, 'TERRAFORM');

      expect(bid).toBeDefined();
      expect(bid.allocatedInstanceIds.length).toBe(4);
      expect(bid.status).toBe('FULFILLED');
      expect(bid.iacDefinition).toContain('resource "aws_spot_instance_request"');
      expect(bid.iacDefinition).toContain('count                = 4');
    });

    it('should support Pulumi TypeScript spec generation', async () => {
      const candidates = await service.fetchSpotPrices('AWS');
      const bid = await service.placeSpotBid(candidates[0], 2, 'PULUMI');

      expect(bid.provisioner).toBe('PULUMI');
      expect(bid.iacDefinition).toContain('new aws.ec2.SpotInstanceRequest');
    });
  });

  describe('handleTerminationNotice (2-Minute Warning SLA)', () => {
    it('should cordon, gracefully drain, and provision replacement node', async () => {
      const candidates = await service.fetchSpotPrices('AWS');
      const bid = await service.placeSpotBid(candidates[0], 1);
      const instanceId = bid.allocatedInstanceIds[0];

      const notice = await service.handleTerminationNotice('AWS', instanceId);

      expect(notice.cordoned).toBe(true);
      expect(notice.gracefullyDrained).toBe(true);
      expect(notice.remainingSeconds).toBe(120);
      expect(notice.replacementOrderId).toBeDefined();
    });
  });

  describe('calculateFleetSavings (>65% cost reduction)', () => {
    it('should verify runner fleet compute expenses are reduced by over 65%', async () => {
      // Place bids across multiple nodes
      const candidates = await service.fetchSpotPrices('AWS');
      await service.placeSpotBid(candidates[0], 8);

      const metrics = service.calculateFleetSavings();

      expect(metrics.savingsPercent).toBeGreaterThan(65.0);
      expect(metrics.totalSavingsUSD).toBeGreaterThan(0);
      expect(metrics.activeSpotNodes).toBe(8);
    });
  });
});
