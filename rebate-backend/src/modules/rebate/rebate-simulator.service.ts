import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AssetType } from '@prisma/client';

export interface SimulatorNodeInput {
  nodeId: string;
  nodeName: string;
  level: number;
  assets: Record<string, number>; // assetType -> total rebate pips held/received at this node
}

export interface ScenarioNodeItem {
  nodeId: string;
  nodeName: string;
  level: number;
  white_in: number;
  white_hold: number;
  pct: string;
  white_pass: number;
  retainedPips: Record<string, number>; // r_self per assetType
  minSelf: number;
}

export interface RebateScenario {
  scenarioId: number;
  variance: number;
  maxHold: number;
  table1: Array<{
    nodeId: string;
    nodeName: string;
    level: number;
    retainedPips: Record<string, number>;
  }>;
  table2: Array<{
    nodeId: string;
    nodeName: string;
    level: number;
    white_in: number;
    white_hold: number;
    pct: string;
    white_pass: number;
  }>;
  nodes: ScenarioNodeItem[];
}

@Injectable()
export class RebateSimulatorService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Backtracking Solver (TypeScript conversion of AI-Engine.py solve_ball_allocation)
   */
  solveBallAllocation(
    treeNodes: SimulatorNodeInput[],
    totalWhiteBalls: number,
    selectedAssets?: string[],
  ): RebateScenario[] {
    if (!treeNodes || treeNodes.length === 0) {
      return [];
    }

    const rawAssetsList =
      selectedAssets && selectedAssets.length > 0
        ? selectedAssets
        : Object.values(AssetType);

    const lastNode = treeNodes[treeNodes.length - 1];

    // Filter assets where the last IB in the active branch has rebate pips >= 1
    const lastNodeActiveAssets = rawAssetsList.filter(
      (asset) => (lastNode.assets[asset] ?? 0) >= 1,
    );

    // Fallback if no assets have >= 1 at the last node
    const activeAssets =
      lastNodeActiveAssets.length > 0
        ? lastNodeActiveAssets
        : rawAssetsList.filter((asset) =>
            treeNodes.some((node) => (node.assets[asset] ?? 0) > 0),
          );

    const assetsList = activeAssets.length > 0 ? activeAssets : rawAssetsList;

    // Prepare nodes: If Node 0 (MIB) base cap < Level 1 rebate pips, add totalWhiteBalls to MIB cap
    const preparedNodes: SimulatorNodeInput[] = treeNodes.map((node, idx) => {
      if (idx === 0 && treeNodes.length > 1) {
        const adjustedAssets: Record<string, number> = { ...node.assets };
        assetsList.forEach((asset) => {
          const mibBase = node.assets[asset] ?? 0;
          const level1Pips = treeNodes[1].assets[asset] ?? 0;
          if (mibBase < level1Pips) {
            adjustedAssets[asset] = mibBase + totalWhiteBalls;
          }
        });
        return { ...node, assets: adjustedAssets };
      }
      return node;
    });

    const validScenarios: ScenarioNodeItem[][] = [];

    const backtrack = (
      nodeIndex: number,
      currentWhiteIn: number,
      currentPath: ScenarioNodeItem[],
    ) => {
      if (nodeIndex === preparedNodes.length) {
        validScenarios.push(currentPath);
        return;
      }

      const currentNode = preparedNodes[nodeIndex];
      const isLastNode = nodeIndex === preparedNodes.length - 1;

      const retainedPips: Record<string, number> = {};
      let minSelf = Infinity;

      for (const asset of assetsList) {
        const holdAsset = currentNode.assets[asset] ?? 0;
        const passAssetNext = !isLastNode
          ? (preparedNodes[nodeIndex + 1].assets[asset] ?? 0)
          : 0;
        const selfPips = Math.max(0, holdAsset - passAssetNext);
        retainedPips[asset] = selfPips;
        if (selfPips < minSelf) {
          minSelf = selfPips;
        }
      }

      if (minSelf === Infinity) {
        minSelf = 0;
      }

      if (currentWhiteIn === 0) {
        const pctStr = isLastNode ? '100%' : '0%';
        const nodeRes: ScenarioNodeItem = {
          nodeId: currentNode.nodeId,
          nodeName: currentNode.nodeName,
          level: currentNode.level,
          white_in: 0,
          white_hold: 0,
          pct: pctStr,
          white_pass: 0,
          retainedPips,
          minSelf,
        };
        backtrack(nodeIndex + 1, 0, [...currentPath, nodeRes]);
      } else if (isLastNode) {
        const wHold = currentWhiteIn;
        if (wHold <= minSelf) {
          const nodeRes: ScenarioNodeItem = {
            nodeId: currentNode.nodeId,
            nodeName: currentNode.nodeName,
            level: currentNode.level,
            white_in: currentWhiteIn,
            white_hold: wHold,
            pct: '100%',
            white_pass: 0,
            retainedPips,
            minSelf,
          };
          backtrack(nodeIndex + 1, 0, [...currentPath, nodeRes]);
        }
      } else {
        const maxPossibleHold = Math.min(currentWhiteIn, minSelf);

        for (let wHold = 0; wHold <= maxPossibleHold; wHold++) {
          const wPass = currentWhiteIn - wHold;
          const pctVal = (wHold / currentWhiteIn) * 100;
          let pctStr = `${pctVal.toFixed(2).replace(/\.?0+$/, '')}%`;
          if (pctStr === '%') {
            pctStr = '0%';
          }

          const nodeRes: ScenarioNodeItem = {
            nodeId: currentNode.nodeId,
            nodeName: currentNode.nodeName,
            level: currentNode.level,
            white_in: currentWhiteIn,
            white_hold: wHold,
            pct: pctStr,
            white_pass: wPass,
            retainedPips,
            minSelf,
          };

          backtrack(nodeIndex + 1, wPass, [...currentPath, nodeRes]);
        }
      }
    };

    backtrack(0, totalWhiteBalls, []);

    // Calculate variance / evenness score and sort scenarios
    const scoredScenarios = validScenarios.map((sc) => {
      const holds = sc.map((item) => item.white_hold);
      const mean = holds.reduce((a, b) => a + b, 0) / holds.length;
      const variance =
        holds.reduce((sum, h) => sum + Math.pow(h - mean, 2), 0) / holds.length;
      const maxHold = Math.max(...holds);

      return {
        variance,
        maxHold,
        path: sc,
      };
    });

    scoredScenarios.sort((a, b) => {
      if (Math.abs(a.variance - b.variance) > 1e-6) {
        return a.variance - b.variance;
      }
      return a.maxHold - b.maxHold;
    });

    return scoredScenarios.map((item, idx) => ({
      scenarioId: idx + 1,
      variance: Number(item.variance.toFixed(4)),
      maxHold: item.maxHold,
      table1: item.path.map((n) => ({
        nodeId: n.nodeId,
        nodeName: n.nodeName,
        level: n.level,
        retainedPips: n.retainedPips,
      })),
      table2: item.path.map((n) => ({
        nodeId: n.nodeId,
        nodeName: n.nodeName,
        level: n.level,
        white_in: n.white_in,
        white_hold: n.white_hold,
        pct: n.pct,
        white_pass: n.white_pass,
      })),
      nodes: item.path,
    }));
  }

  /**
   * Simulate allocation for an existing branch starting from MIB down to a specific IB (or leaf)
   */
  async simulateBranch(targetIbId: string, customMarkupPips?: number) {
    // 1. Trace ancestor path from targetIbId up to root MIB
    const ancestors: any[] = await this.prisma.$queryRaw`
      WITH RECURSIVE ancestor_tree AS (
        SELECT id, name, email, level, "parentId", "accountType" FROM ib_nodes WHERE id = ${targetIbId}
        UNION ALL
        SELECT n.id, n.name, n.email, n.level, n."parentId", n."accountType" FROM ib_nodes n
        INNER JOIN ancestor_tree a ON n.id = a."parentId"
      )
      SELECT id, name, email, level, "parentId", "accountType" FROM ancestor_tree ORDER BY level ASC
    `;

    if (!ancestors || ancestors.length === 0) {
      throw new NotFoundException(`IB node ${targetIbId} not found`);
    }

    // 2. Fetch RebateConfig for all nodes in the branch
    const nodeIds = ancestors.map((n) => n.id);
    const configs = await this.prisma.rebateConfig.findMany({
      where: { ibId: { in: nodeIds } },
    });

    const configMap: Record<string, Record<string, number>> = {};
    nodeIds.forEach((id) => {
      configMap[id] = {};
    });

    configs.forEach((c) => {
      const pips = Number(c.rebatePips || 0);
      const maxPips = Number(c.maxPips || 0);
      configMap[c.ibId][c.assetType] = c.maxPips !== undefined ? maxPips : pips;
    });

    // Determine total markup pips (white balls)
    let markupPips = customMarkupPips;
    if (markupPips === undefined || markupPips === null) {
      const level1Node = ancestors.find((a) => a.level === 1) || ancestors[0];
      const match = level1Node?.accountType?.match(/(\d+(?:\.\d+)?)/);
      markupPips = match ? parseFloat(match[1]) : 10;
    }

    const treeNodes: SimulatorNodeInput[] = ancestors.map((node) => {
      const assets: Record<string, number> = {};
      Object.values(AssetType).forEach((asset) => {
        assets[asset] = configMap[node.id]?.[asset] ?? 0;
      });
      return {
        nodeId: node.id,
        nodeName: node.name || node.email || `IB L${node.level}`,
        level: node.level,
        assets,
      };
    });

    const scenarios = this.solveBallAllocation(treeNodes, markupPips);
    return {
      branch: ancestors.map((a) => ({
        id: a.id,
        name: a.name || a.email,
        level: a.level,
        accountType: a.accountType,
      })),
      markupPips,
      totalScenarios: scenarios.length,
      scenarios,
    };
  }
}
