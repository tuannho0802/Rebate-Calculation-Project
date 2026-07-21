import { AssetType, RebateScenario, ScenarioNodeItem } from '@/types';

export interface SolverNodeInput {
  nodeId: string;
  nodeName: string;
  level: number;
  assets: Record<string, number>;
}

export function solveBallAllocation(
  treeNodes: SolverNodeInput[],
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
  const preparedNodes: SolverNodeInput[] = treeNodes.map((node, idx) => {
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
