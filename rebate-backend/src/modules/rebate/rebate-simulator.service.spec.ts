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
});
