import { RebateSimulatorService } from './rebate-simulator.service';

describe('RebateSimulatorService', () => {
  let service: RebateSimulatorService;

  beforeEach(() => {
    // Pass null as PrismaService since solveBallAllocation is pure logic
    service = new RebateSimulatorService(null as any);
  });

  it('should match AI-Engine.py results for mock demo (x=12, y=20, z=20, n=4)', () => {
    // Equivalent to AI-Engine.py mock demo:
    // x = 12 (GOLD rebate), y = 20 (FOREX rebate), z = 20 (Markup)
    // Rổ 1 = 12 + 20 = 32
    // Rổ 2 = 20 + 20 = 40
    // Node 1 (MIB): 32, 40 -> passes 26, 34
    // Node 2 (L1):  26, 34 -> passes 20, 28
    // Node 3 (L2):  20, 28 -> passes 15, 20
    // Node 4 (L3):  15, 20

    const treeNodes = [
      { nodeId: 'n1', nodeName: 'Nguoi 1 (MIB)', level: 0, assets: { GOLD: 32, FOREX: 40 } },
      { nodeId: 'n2', nodeName: 'Nguoi 2 (L1)',  level: 1, assets: { GOLD: 26, FOREX: 34 } },
      { nodeId: 'n3', nodeName: 'Nguoi 3 (L2)',  level: 2, assets: { GOLD: 20, FOREX: 28 } },
      { nodeId: 'n4', nodeName: 'Nguoi 4 (L3)',  level: 3, assets: { GOLD: 15, FOREX: 20 } },
    ];

    const totalMarkupPips = 20;

    const scenarios = service.solveBallAllocation(treeNodes, totalMarkupPips, ['GOLD', 'FOREX']);

    expect(scenarios.length).toBeGreaterThan(0);
    const topScenario = scenarios[0];

    // Verify structure
    expect(topScenario.nodes.length).toBe(4);
    
    // Check self-retained calculation for Node 1:
    // GOLD self: 32 - 26 = 6
    // FOREX self: 40 - 34 = 6
    expect(topScenario.nodes[0].retainedPips['GOLD']).toBe(6);
    expect(topScenario.nodes[0].retainedPips['FOREX']).toBe(6);

    // Node 2 self:
    // GOLD self: 26 - 20 = 6
    // FOREX self: 34 - 28 = 6
    expect(topScenario.nodes[1].retainedPips['GOLD']).toBe(6);
    expect(topScenario.nodes[1].retainedPips['FOREX']).toBe(6);

    // Node 3 self:
    // GOLD self: 20 - 15 = 5
    // FOREX self: 28 - 20 = 8
    expect(topScenario.nodes[2].retainedPips['GOLD']).toBe(5);
    expect(topScenario.nodes[2].retainedPips['FOREX']).toBe(8);

    // Node 4 self (last node):
    // GOLD self: 15
    // FOREX self: 20
    expect(topScenario.nodes[3].retainedPips['GOLD']).toBe(15);
    expect(topScenario.nodes[3].retainedPips['FOREX']).toBe(20);

    // Check last node markup percentage is 100%
    expect(topScenario.nodes[3].pct).toBe('100%');
  });

  it('should treat rebate pips <= 0.01 as 0 when calculating markup distribution', () => {
    const treeNodes = [
      { nodeId: 'n1', nodeName: 'Nguoi 1 (MIB)', level: 0, assets: { GOLD: 20 } },
      { nodeId: 'n2', nodeName: 'Nguoi 2 (L1)',  level: 1, assets: { GOLD: 10 } },
      { nodeId: 'n3', nodeName: 'Nguoi 3 (L2)',  level: 2, assets: { GOLD: 0.01 } },
    ];

    const totalMarkupPips = 10;
    const scenarios = service.solveBallAllocation(treeNodes, totalMarkupPips, ['GOLD']);

    expect(scenarios.length).toBeGreaterThan(0);
    const topScenario = scenarios[0];

    // n3 (L2) should get 0 white_hold and '0%' percentage because its effective rebate is 0
    expect(topScenario.nodes[2].white_hold).toBe(0);
    expect(topScenario.nodes[2].pct).toBe('0%');

    // Total markup should still be 10, distributed to n1 and n2
    const n1Hold = topScenario.nodes[0].white_hold;
    const n2Hold = topScenario.nodes[1].white_hold;
    expect(n1Hold + n2Hold).toBe(10);
  });

  it('should ignore unallocated assets (Level 1 rebate = 0) and calculate markup scenarios correctly', () => {
    const treeNodes = [
      {
        nodeId: 'n1',
        nodeName: 'Nguoi 1 (MIB)',
        level: 0,
        assets: {
          FOREX: 22,      // Active asset (allocated)
          D_FOREX: 22,    // Inactive asset (unallocated)
        },
      },
      {
        nodeId: 'n2',
        nodeName: 'Nguoi 2 (L1)',
        level: 1,
        assets: {
          FOREX: 12,      // Level 1 receives 12 for FOREX
          D_FOREX: 0,     // Level 1 receives 0 for D_FOREX (unallocated)
        },
      },
      {
        nodeId: 'n3',
        nodeName: 'Nguoi 3 (L2)',
        level: 2,
        assets: {
          FOREX: 10,
          D_FOREX: 0,
        },
      },
      {
        nodeId: 'n4',
        nodeName: 'Nguoi 4 (L3)',
        level: 3,
        assets: {
          FOREX: 5,
          D_FOREX: 0,
        },
      },
      {
        nodeId: 'n5',
        nodeName: 'Nguoi 5 (L4)',
        level: 4,
        assets: {
          FOREX: 0.01,    // Treated as 0, making Level 3 have effective self pips = 5
          D_FOREX: 0,
        },
      },
    ];

    const totalMarkupPips = 10;
    const scenarios = service.solveBallAllocation(treeNodes, totalMarkupPips, ['FOREX', 'D_FOREX']);

    // Should find multiple scenarios because D_FOREX is filtered out from assetsList
    // and FOREX has sufficient self pips at L1 (12 - 10 = 2), L2 (10 - 5 = 5), L3 (5 - 0 = 5)
    expect(scenarios.length).toBeGreaterThan(1);

    // Verify top scenario distributes some pips to active levels (like L2 and L3)
    const hasScenarioWithL2OrL3Hold = scenarios.some((sc) => {
      const l2Hold = sc.nodes[2].white_hold;
      const l3Hold = sc.nodes[3].white_hold;
      return l2Hold > 0 || l3Hold > 0;
    });
    expect(hasScenarioWithL2OrL3Hold).toBe(true);
  });
});
