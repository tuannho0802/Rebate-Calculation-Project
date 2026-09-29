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

  // Preprocess assets: treat values <= 0.01 as 0
  const processedTreeNodes = treeNodes.map((node) => {
    const cleanedAssets: Record<string, number> = {};
    for (const asset in node.assets) {
      const val = node.assets[asset] ?? 0;
      cleanedAssets[asset] = val <= 0.01 ? 0 : val;
    }
    return {
      ...node,
      assets: cleanedAssets,
    };
  });

  // Filter active assets: Lọc các asset đã chia Rebate đầy đủ từ đầu đến cuối nhánh (mọi node từ MIB đến node cuối đều có rebate > 0, tính cả 0.01)
  const fullyAllocatedAssets = treeNodes.length > 1
    ? rawAssetsList.filter((asset) => treeNodes.every((node) => (node.assets[asset] ?? 0) > 0))
    : rawAssetsList.filter((asset) => (treeNodes[0]?.assets[asset] ?? 0) > 0);

  const activeAssets = fullyAllocatedAssets.length > 0
    ? fullyAllocatedAssets
    : rawAssetsList.filter((asset) =>
        treeNodes.some((node) => (node.assets[asset] ?? 0) > 0),
      );

  const assetsList = activeAssets.length > 0 ? activeAssets : rawAssetsList;

  // Prepare nodes: If Node 0 (MIB) base cap < Level 1 rebate pips, add totalWhiteBalls to MIB cap
  const preparedNodes: SolverNodeInput[] = processedTreeNodes.map((node, idx) => {
    if (idx === 0 && processedTreeNodes.length > 1) {
      const adjustedAssets: Record<string, number> = { ...node.assets };
      assetsList.forEach((asset) => {
        const mibBase = node.assets[asset] ?? 0;
        const level1Pips = processedTreeNodes[1].assets[asset] ?? 0;
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

      const effectiveSelf = selfPips <= 0.01 ? 0 : selfPips;
      if (effectiveSelf < minSelf) {
        minSelf = effectiveSelf;
      }
    }

    if (minSelf === Infinity) {
      minSelf = 0;
    }

    if (currentWhiteIn === 0) {
      const nodeRes: ScenarioNodeItem = {
        nodeId: currentNode.nodeId,
        nodeName: currentNode.nodeName,
        level: currentNode.level,
        white_in: 0,
        white_hold: 0,
        pct: '0%',
        white_pass: 0,
        retainedPips,
        minSelf,
      };
      backtrack(nodeIndex + 1, 0, [...currentPath, nodeRes]);
    } else if (isLastNode) {
      const wHold = currentWhiteIn;
      if (wHold <= minSelf) {
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
