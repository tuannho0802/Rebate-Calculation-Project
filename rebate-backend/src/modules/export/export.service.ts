import * as ExcelJS from 'exceljs';
import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RebateSimulatorService, SimulatorNodeInput } from '../rebate/rebate-simulator.service';

@Injectable()
export class ExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rebateSimulatorService: RebateSimulatorService,
  ) {}

  private async getIbTreeByLevel(rootIbId: string): Promise<Record<number, any[]>> {
    const root = await this.prisma.ibNode.findUnique({
      where: { id: rootIbId },
      include: { rebateConfig: true },
    });
    if (!root) return {};

    const tree: Record<number, any[]> = {};
    const queue: { id: string; level: number }[] = [{ id: root.id, level: root.level }];

    while (queue.length > 0) {
      const { id, level } = queue.shift()!;
      const depth = level - root.level;
      if (depth > 6) continue;

      const node = await this.prisma.ibNode.findUnique({
        where: { id },
        include: {
          children: { select: { id: true, level: true } },
          rebateConfig: true,
        },
      });
      if (!node) continue;

      if (!tree[depth]) tree[depth] = [];
      tree[depth].push(node);

      for (const child of node.children) {
        queue.push({ id: child.id, level: child.level });
      }
    }

    return tree;
  }

  async generateRebateConfigExcel(rootIbId: string): Promise<Buffer> {
    return this.generateCustomTreeRebateExcel(rootIbId);
  }

  async generateTransactionsExcel(
    rootIbId: string,
    targetIbId: string,
    period: string,
  ): Promise<Buffer> {
    if (targetIbId && rootIbId !== targetIbId) {
      const rootLevel = (await this.prisma.ibNode.findUnique({ where: { id: rootIbId } }))?.level;
      if (rootLevel !== 0) {
        const tree = await this.getIbTreeByLevel(rootIbId);
        let found = false;
        for (const level in tree) {
          if (tree[level].some((n) => n.id === targetIbId)) {
            found = true;
            break;
          }
        }
        if (!found) {
          throw new ForbiddenException({
            code: 'IB_NOT_IN_SUBTREE',
            message: 'IB không thuộc nhánh của bạn',
          });
        }
      }
    }

    const searchIbId = targetIbId || rootIbId;

    let startDate: Date | undefined, endDate: Date | undefined;
    if (period) {
      const [year, month] = period.split('-');
      startDate = new Date(Date.UTC(Number(year), Number(month) - 1, 1));
      endDate = new Date(Date.UTC(Number(year), Number(month), 1));
    }

    const txs = await this.prisma.rebateTransaction.findMany({
      where: {
        ibId: searchIbId,
        ...(period ? { tradedAt: { gte: startDate, lt: endDate } } : {}),
      },
      include: {
        ib: { select: { email: true, name: true } },
      },
      orderBy: { tradedAt: 'desc' },
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Rebate System';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Transactions');

    const HDR_BG = 'FF1F3864';
    const HDR_FONT = 'FFFFFFFF';
    const ODD_BG = 'FFF2F7FF';
    const EVEN_BG = 'FFFFFFFF';

    sheet.columns = [
      { key: 'date', width: 22 },
      { key: 'name', width: 20 },
      { key: 'email', width: 28 },
      { key: 'assetType', width: 16 },
      { key: 'rebateType', width: 16 },
      { key: 'lots', width: 12 },
      { key: 'rebateAmount', width: 16 },
      { key: 'currency', width: 10 },
    ];

    const headers = ['Trade Date', 'IB Name', 'IB Email', 'Asset Type', 'Rebate Type', 'Lots', 'Rebate Amount', 'Currency'];

    sheet.mergeCells('A1:H1');
    const title = sheet.getCell('A1');
    title.value = `TRANSACTION HISTORY${period ? ' — ' + period : ''}`;
    title.font = { bold: true, size: 13, color: { argb: HDR_FONT }, name: 'Calibri' };
    title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HDR_BG } };
    title.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 26;

    sheet.mergeCells('A2:H2');
    const subCell = sheet.getCell('A2');
    subCell.value = `Generated: ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}   |   Total records: ${txs.length}`;
    subCell.font = { italic: true, size: 9, color: { argb: '80808080' }, name: 'Calibri' };
    subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
    subCell.alignment = { horizontal: 'right', vertical: 'middle' };
    sheet.getRow(2).height = 15;

    const headerRow = sheet.getRow(3);
    headerRow.height = 22;
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.font = { bold: true, size: 10, color: { argb: HDR_FONT }, name: 'Calibri' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E75B6' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF1F3864' } },
        bottom: { style: 'medium', color: { argb: 'FF1F3864' } },
        left: { style: 'thin', color: { argb: 'FF1F3864' } },
        right: { style: 'thin', color: { argb: 'FF1F3864' } },
      };
    });

    txs.forEach((tx, idx) => {
      const row = sheet.addRow({
        date: tx.tradedAt.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
        name: tx.ib.name || '—',
        email: tx.ib.email,
        assetType: tx.assetType,
        rebateType: tx.rebateType,
        lots: Number(tx.lots),
        rebateAmount: Number(tx.rebateAmount),
        currency: tx.currency,
      });

      row.height = 17;
      const rowBg = idx % 2 === 0 ? ODD_BG : EVEN_BG;

      row.eachCell((cell, colNumber) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
        cell.font = { size: 10, name: 'Calibri' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
          bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
          left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
          right: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        };

        if (colNumber === 1 || colNumber === 2 || colNumber === 3) cell.alignment = { horizontal: 'left' };
        else if (colNumber === 6 || colNumber === 7) {
          cell.alignment = { horizontal: 'right' };
          cell.numFmt = '#,##0.########';
        } else {
          cell.alignment = { horizontal: 'center' };
        }

        if (colNumber === 7 && Number(tx.rebateAmount) > 0) {
          cell.font = { bold: true, size: 10, color: { argb: 'FF375623' }, name: 'Calibri' };
        }
      });
    });

    if (txs.length > 0) {
      const totalRow = sheet.addRow({
        date: 'TOTAL',
        lots: txs.reduce((s, t) => s + Number(t.lots), 0),
        rebateAmount: txs.reduce((s, t) => s + Number(t.rebateAmount), 0),
        currency: txs[0]?.currency || '',
      });
      totalRow.height = 20;
      totalRow.eachCell((cell, colNumber) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
        cell.font = { bold: true, size: 10, name: 'Calibri' };
        cell.border = {
          top: { style: 'medium', color: { argb: 'FF2E75B6' } },
          bottom: { style: 'medium', color: { argb: 'FF2E75B6' } },
          left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
          right: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        };
        if (colNumber === 6 || colNumber === 7) {
          cell.numFmt = '#,##0.########';
          cell.alignment = { horizontal: 'right' };
        } else if (colNumber === 1) {
          cell.alignment = { horizontal: 'left' };
        } else {
          cell.alignment = { horizontal: 'center' };
        }
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer as any as Buffer;
  }

  /**
   * XUẤT 1 BẢNG HIỂN THỊ CHUẨN TRÊN WEB CHO MỖI LOẠI TÀI KHOẢN & MỖI NHÁNH
   */
  async generateCustomTreeRebateExcel(rootIbId?: string): Promise<Buffer> {
    const allNodes = await this.prisma.ibNode.findMany({
      where: { isActive: true },
      include: { rebateConfig: true, accountTypeTemplates: true },
    });

    const nodeMap = new Map<string, any>();
    const childrenMap = new Map<string, any[]>();

    for (const n of allNodes) {
      nodeMap.set(n.id, n);
      if (n.parentId) {
        const list = childrenMap.get(n.parentId) || [];
        list.push(n);
        childrenMap.set(n.parentId, list);
      }
    }

    let mibRoots: any[] = [];
    if (rootIbId) {
      const selectedNode = nodeMap.get(rootIbId);
      if (selectedNode) {
        let topRoot = selectedNode;
        while (topRoot.parentId && nodeMap.has(topRoot.parentId)) {
          topRoot = nodeMap.get(topRoot.parentId);
        }
        mibRoots = [topRoot];
      }
    }

    if (mibRoots.length === 0) {
      mibRoots = allNodes.filter((n) => n.level === 0 || !n.parentId);
    }
    if (mibRoots.length === 0 && allNodes.length > 0) {
      mibRoots = [allNodes[0]];
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Rebate Management System';
    workbook.created = new Date();

    const ASSET_TYPES = [
      { key: 'D_FOREX',        label: 'D_FOREX',         maxPips: 12 },
      { key: 'FOREX',          label: 'FOREX',           maxPips: 12 },
      { key: 'GOLD',           label: 'GOLD',            maxPips: 20 },
      { key: 'SILVER_5000',    label: 'SILVER_5000',     maxPips: 80 },
      { key: 'SILVER_1000',    label: 'SILVER_1000',     maxPips: 20 },
      { key: 'OIL',            label: 'OIL',             maxPips: 20 },
      { key: 'NATURE_GAS',     label: 'NATURE_GAS',      maxPips: 35 },
      { key: 'COMMODITIES',    label: 'COMMODITIES',     maxPips: 3  },
      { key: 'HKG50',          label: 'HKG50',           maxPips: 20 },
      { key: 'A50',            label: 'A50',             maxPips: 40 },
      { key: 'JPN225',         label: 'JPN225',          maxPips: 50 },
      { key: 'US_INDEX',       label: 'US_INDEX',        maxPips: 2.3},
      { key: 'SHARES',         label: 'SHARES',          maxPips: 1.5},
      { key: 'ETHEREUM',       label: 'ETHEREUM',        maxPips: 3  },
      { key: 'PRECIOUS_METAL', label: 'PRECIOUS_METAL',  maxPips: 20 },
      { key: 'BITCOIN',        label: 'BITCOIN',         maxPips: 3  },
      { key: 'CRYPTO',         label: 'CRYPTO',          maxPips: 1.5},
      { key: 'GAUCNH',         label: 'GAUCNH',          maxPips: 7  },
    ];

    const applyCellBorder = (cell: ExcelJS.Cell, color = 'FFD9D9D9') => {
      cell.border = {
        top:    { style: 'thin', color: { argb: color } },
        left:   { style: 'thin', color: { argb: color } },
        bottom: { style: 'thin', color: { argb: color } },
        right:  { style: 'thin', color: { argb: color } },
      };
    };

    const getBranches = (nodeId: string, currentPath: any[] = []): any[][] => {
      const node = nodeMap.get(nodeId);
      if (!node) return [];
      const path = [...currentPath, node];
      const children = childrenMap.get(nodeId) || [];
      if (children.length === 0) return [path];
      let branches: any[][] = [];
      for (const child of children) {
        branches.push(...getBranches(child.id, path));
      }
      return branches;
    };

    const getNodeConfig = (node: any, assetKey: string, accType: string) => {
      const cfgs = node.rebateConfig || [];
      const hasAccTypeConfigs = cfgs.some((c: any) => c.accountType === accType);
      if (hasAccTypeConfigs) {
        return cfgs.find((c: any) => c.assetType === assetKey && c.accountType === accType);
      }
      return cfgs.find((c: any) => c.assetType === assetKey);
    };

    const getNodeReceivedPips = (node: any, assetKey: string, accType: string): number => {
      const cfg = getNodeConfig(node, assetKey, accType);
      if (cfg) {
        if (cfg.rebatePips !== undefined && cfg.rebatePips !== null) {
          return Number(cfg.rebatePips);
        }
        if (cfg.maxPips !== undefined && cfg.maxPips !== null) {
          return Number(cfg.maxPips);
        }
      }
      return 0;
    };

    const usedSheetNames = new Set<string>();

    for (let mibIndex = 0; mibIndex < mibRoots.length; mibIndex++) {
      const rootNode = mibRoots[mibIndex];
      let rawName = (rootNode.name || rootNode.email.split('@')[0] || `MIB_${mibIndex + 1}`)
        .replace(/[:\\/?*\[\]]/g, '')
        .trim();
      if (!rawName) rawName = `MIB_${mibIndex + 1}`;
      let baseName = rawName.slice(0, 28);
      let sheetName = baseName;
      let counter = 1;
      while (usedSheetNames.has(sheetName.toLowerCase())) {
        sheetName = `${baseName}_${counter}`;
        counter++;
      }
      usedSheetNames.add(sheetName.toLowerCase());

      const sheet = workbook.addWorksheet(sheetName, {
        views: [{ showGridLines: true }],
      });

      const branches = getBranches(rootNode.id);
      let currentRow = 1;

      // ROW 1: EMAIL MIB CHÍNH TRÊN CÙNG
      const row1 = sheet.getRow(currentRow);
      row1.height = 24;
      const cellA1 = row1.getCell(1);
      cellA1.value = rootNode.email;
      cellA1.font = { bold: true, size: 11, color: { argb: 'FF833C00' }, name: 'Calibri' };
      cellA1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4D6' } };
      cellA1.alignment = { horizontal: 'left', vertical: 'middle' };
      applyCellBorder(cellA1, 'FFC55A11');

      currentRow += 2;

      for (let bIdx = 0; bIdx < branches.length; bIdx++) {
        const branchPath = branches[bIdx];

        const branchTitleParts = branchPath.map((n, idx) => {
          const roleLabel = idx === 0 ? 'MIB' : `Level ${idx}`;
          const displayName = n.name ? `${n.name}` : n.email.split('@')[0];
          return `${roleLabel}: ${displayName}`;
        });
        const branchTitleText = `NHÁNH ${bIdx + 1}: ${branchTitleParts.join(' ➔ ')}`;

        const titleRow = sheet.getRow(currentRow);
        titleRow.height = 26;
        const titleCell = titleRow.getCell(1);
        titleCell.value = branchTitleText;
        titleCell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' }, name: 'Calibri' };
        titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
        titleCell.alignment = { horizontal: 'left', vertical: 'middle' };

        const maxMergedCols = Math.max(10, branchPath.length + 2);
        sheet.mergeCells(currentRow, 1, currentRow, maxMergedCols);
        for (let c = 1; c <= maxMergedCols; c++) {
          const cCell = titleRow.getCell(c);
          cCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
          applyCellBorder(cCell, 'FF1F4E78');
        }

        currentRow += 2;

        const accountTypesSet = new Set<string>();
        for (const n of branchPath) {
          if (n.accountType) accountTypesSet.add(n.accountType);
          if (Array.isArray(n.rebateConfig)) {
            n.rebateConfig.forEach((c: any) => {
              if (c.accountType) accountTypesSet.add(c.accountType);
            });
          }
          if (Array.isArray(n.accountTypeTemplates)) {
            n.accountTypeTemplates.forEach((t: any) => {
              if (t.name) accountTypesSet.add(t.name);
            });
          }
        }

        const priorityOrder = ['STD', 'STD5', 'STD10', 'STD15', 'STD20'];
        const accountTypes = Array.from(accountTypesSet).filter(Boolean);
        if (accountTypes.length === 0) accountTypes.push('STD');

        accountTypes.sort((a, b) => {
          const idxA = priorityOrder.indexOf(a);
          const idxB = priorityOrder.indexOf(b);
          if (idxA !== -1 && idxB !== -1) return idxA - idxB;
          if (idxA !== -1) return -1;
          if (idxB !== -1) return 1;
          return a.localeCompare(b);
        });

        for (let accIdx = 0; accIdx < accountTypes.length; accIdx++) {
          const accType = accountTypes[accIdx];

          // LẤY TOTAL MARKUP PIPS CỦA LOẠI TÀI KHOẢN
          let totalMarkupPips = 0;
          const rootConfig = branchPath[0]?.rebateConfig?.find((c: any) => c.accountType === accType);
          if (rootConfig && rootConfig.markupPips !== undefined && rootConfig.markupPips !== null) {
            totalMarkupPips = Number(rootConfig.markupPips);
          } else {
            const matchPips = accType.match(/(\d+(?:\.\d+)?)/);
            totalMarkupPips = matchPips ? parseFloat(matchPips[1]) : 0;
          }

          // SIMULATOR UNIFIED SOLVER FOR MARKUP OPTION
          const fullBranchSolverInput: SimulatorNodeInput[] = branchPath.map((node, idx) => {
            const isRoot = idx === 0;
            const lvl = isRoot ? 0 : idx;
            const assets: Record<string, number> = {};

            ASSET_TYPES.forEach(({ key, maxPips: defaultMaxPips }) => {
              if (isRoot) {
                const mibAssetConfig = getNodeConfig(node, key, accType);
                const mibBaseCap = mibAssetConfig?.maxPips !== undefined && mibAssetConfig?.maxPips !== null
                  ? Number(mibAssetConfig.maxPips)
                  : defaultMaxPips;
                assets[key] = mibBaseCap > 0 ? mibBaseCap + totalMarkupPips : 0;
              } else {
                const cfg = getNodeConfig(node, key, accType);
                assets[key] = cfg?.rebatePips !== undefined && cfg?.rebatePips !== null ? Number(cfg.rebatePips) : 0;
              }
            });

            return {
              nodeId: node.id,
              nodeName: node.name || node.email,
              level: lvl,
              assets,
            };
          });

          const fullScenarios = this.rebateSimulatorService.solveBallAllocation(
            fullBranchSolverInput,
            totalMarkupPips,
            ASSET_TYPES.map((a) => a.key),
          );

          const fullActiveScenario = fullScenarios[0];
          const fullMarkupHolds: number[] = branchPath.map((node, idx) => {
            if (fullActiveScenario && fullActiveScenario.nodes && fullActiveScenario.nodes[idx]) {
              return fullActiveScenario.nodes[idx].white_hold;
            }
            const cfgs = node.rebateConfig || [];
            const cfg = cfgs.find((c: any) => c.accountType === accType) || cfgs[0];
            return cfg?.markupPips !== undefined && cfg?.markupPips !== null ? Number(cfg.markupPips) : 0;
          });

          // TÍNH VECTOR PIPS GIỮ LẠI CHO CẢ NHÁNH (TRẮC CỦA TỪNG NODE TRÊN WEB)
          const retainedMap: Record<string, number[]> = {};
          for (const asset of ASSET_TYPES) {
            const retainedArr: number[] = new Array(branchPath.length).fill(0);
            for (let lvIdx = 0; lvIdx < branchPath.length; lvIdx++) {
              const currentNode = branchPath[lvIdx];
              const hold = fullMarkupHolds[lvIdx] || 0;

              if (lvIdx === 0) {
                const mibAssetConfig = getNodeConfig(currentNode, asset.key, accType);
                const mibBaseCap = mibAssetConfig?.maxPips !== undefined && mibAssetConfig?.maxPips !== null
                  ? Number(mibAssetConfig.maxPips)
                  : asset.maxPips;
                const level1Node = branchPath[1];
                const mibGiven = level1Node ? getNodeReceivedPips(level1Node, asset.key, accType) : 0;

                if (mibGiven > 0) {
                  const mibCap = mibBaseCap > 0 ? mibBaseCap + totalMarkupPips : 0;
                  retainedArr[0] = Math.max(0, mibCap - mibGiven - hold);
                } else {
                  retainedArr[0] = mibBaseCap;
                }
              } else {
                const receivedPips = getNodeReceivedPips(currentNode, asset.key, accType);
                if (receivedPips > 0) {
                  const givenPips = lvIdx + 1 < branchPath.length
                    ? getNodeReceivedPips(branchPath[lvIdx + 1], asset.key, accType)
                    : 0;
                  retainedArr[lvIdx] = Math.max(0, receivedPips - givenPips - hold);
                } else {
                  retainedArr[lvIdx] = 0;
                }
              }
            }
            retainedMap[asset.key] = retainedArr;
          }

          // IN 1 BẢNG DUY NHẤT CHO LOẠI TÀI KHOẢN HIỆN TẠI (GIỐNG WEB 100%)
          sheet.getColumn(1).width = 24;
          for (let k = 0; k < branchPath.length; k++) {
            sheet.getColumn(k + 2).width = 26;
          }

          let r = currentRow;

          // 1. Account Type Header
          const accHeaderRow = sheet.getRow(r);
          accHeaderRow.height = 24;
          const accHeaderCell = accHeaderRow.getCell(1);
          accHeaderCell.value = `LOẠI TÀI KHOẢN: ${accType}`;
          accHeaderCell.font = { bold: true, size: 10.5, color: { argb: 'FF1F4E78' }, name: 'Calibri' };
          accHeaderCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
          applyCellBorder(accHeaderCell, 'FF8EA9DB');

          sheet.mergeCells(r, 1, r, branchPath.length + 1);
          for (let c = 1; c <= branchPath.length + 1; c++) {
            const cell = accHeaderRow.getCell(c);
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
            applyCellBorder(cell, 'FF8EA9DB');
          }

          r++;

          // 2. Table Column Headers (Asset Type | MIB | LEVEL 1 | LEVEL 2...)
          const colHeaderRow = sheet.getRow(r);
          colHeaderRow.height = 24;
          const assetTypeHeaderCell = colHeaderRow.getCell(1);
          assetTypeHeaderCell.value = 'Asset Type';
          assetTypeHeaderCell.font = { bold: true, size: 10, color: { argb: 'FF1E293B' }, name: 'Calibri' };
          assetTypeHeaderCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
          assetTypeHeaderCell.alignment = { horizontal: 'left', vertical: 'middle' };
          applyCellBorder(assetTypeHeaderCell, 'FFCBD5E1');

          for (let lvIdx = 0; lvIdx < branchPath.length; lvIdx++) {
            const node = branchPath[lvIdx];
            const roleLabel = lvIdx === 0 ? 'MIB' : `LEVEL ${lvIdx}`;
            const displayName = node.name ? `${node.name}` : node.email.split('@')[0];

            const nodeHeaderCell = colHeaderRow.getCell(lvIdx + 2);
            nodeHeaderCell.value = `${roleLabel}\n${displayName}`;
            nodeHeaderCell.font = { bold: true, size: 9.5, color: { argb: 'FF1F4E78' }, name: 'Calibri' };
            nodeHeaderCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } };
            nodeHeaderCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            applyCellBorder(nodeHeaderCell, 'FFC7D2FE');
          }

          r++;

          // 3. Rebate Rows (18 Asset Types)
          for (const asset of ASSET_TYPES) {
            const dataRow = sheet.getRow(r);
            dataRow.height = 20;

            const assetLabelCell = dataRow.getCell(1);
            assetLabelCell.value = asset.label;
            assetLabelCell.font = { bold: true, size: 9, color: { argb: 'FF1E293B' }, name: 'Calibri' };
            assetLabelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
            assetLabelCell.alignment = { horizontal: 'left', vertical: 'middle' };
            applyCellBorder(assetLabelCell, 'FFCBD5E1');

            const retainedArr = retainedMap[asset.key] || [];
            for (let lvIdx = 0; lvIdx < branchPath.length; lvIdx++) {
              const valCell = dataRow.getCell(lvIdx + 2);
              const val = retainedArr[lvIdx] || 0;
              valCell.value = val;
              valCell.alignment = { horizontal: 'center', vertical: 'middle' };

              if (val > 0) {
                valCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };
                valCell.font = { bold: true, size: 10, color: { argb: 'FF1E4620' }, name: 'Calibri' };
                applyCellBorder(valCell, 'FFA9D18E');
              } else {
                valCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
                valCell.font = { size: 9, color: { argb: 'FF94A3B8' }, name: 'Calibri' };
                applyCellBorder(valCell, 'FFE2E8F0');
              }
            }

            r++;
          }

          // 4. Markup Option Sub-Table
          r++;
          const markupHeaderRow = sheet.getRow(r);
          markupHeaderRow.height = 22;
          const markupTitleCell = markupHeaderRow.getCell(1);
          markupTitleCell.value = 'Markup Option';
          markupTitleCell.font = { bold: true, size: 9.5, color: { argb: 'FF1F4E78' }, name: 'Calibri' };
          markupTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
          applyCellBorder(markupTitleCell, 'FF8EA9DB');

          for (let lvIdx = 0; lvIdx < branchPath.length; lvIdx++) {
            const node = branchPath[lvIdx];
            const roleLabel = lvIdx === 0 ? 'MIB' : `LEVEL ${lvIdx}`;
            const displayName = node.name ? `${node.name}` : node.email.split('@')[0];

            const mCell = markupHeaderRow.getCell(lvIdx + 2);
            mCell.value = `${roleLabel}\n${displayName}`;
            mCell.font = { bold: true, size: 9, color: { argb: 'FF1F4E78' }, name: 'Calibri' };
            mCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
            mCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            applyCellBorder(mCell, 'FF8EA9DB');
          }

          // Row 1: Tỷ Lệ % Giữ Lại
          r++;
          const pctRow = sheet.getRow(r);
          pctRow.height = 20;
          const pctLabelCell = pctRow.getCell(1);
          pctLabelCell.value = 'Tỷ Lệ % Giữ Lại';
          pctLabelCell.font = { bold: true, size: 9, color: { argb: 'FF7F6000' }, name: 'Calibri' };
          pctLabelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
          applyCellBorder(pctLabelCell, 'FFD69E2E');

          for (let lvIdx = 0; lvIdx < branchPath.length; lvIdx++) {
            const pCell = pctRow.getCell(lvIdx + 2);
            applyCellBorder(pCell, 'FFD69E2E');
            pCell.alignment = { horizontal: 'center', vertical: 'middle' };
            pCell.font = { bold: true, size: 9, color: { argb: 'FF7F6000' }, name: 'Calibri' };
            pCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };

            if (totalMarkupPips === 0) {
              pCell.value = lvIdx === branchPath.length - 1 ? '100%' : '0%';
            } else {
              const holdVal = fullMarkupHolds[lvIdx] || 0;
              const pct = (holdVal / totalMarkupPips) * 100;
              pCell.value = `${Number(pct.toFixed(2))}%`;
            }
          }

          // Row 2: Account Type Pips Markup
          r++;
          const pipsRow = sheet.getRow(r);
          pipsRow.height = 20;
          const pipsLabelCell = pipsRow.getCell(1);
          pipsLabelCell.value = `${accType} (${totalMarkupPips} Pips)`;
          pipsLabelCell.font = { bold: true, size: 9, color: { argb: 'FF1E4620' }, name: 'Calibri' };
          pipsLabelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };
          applyCellBorder(pipsLabelCell, 'FFA9D18E');

          for (let lvIdx = 0; lvIdx < branchPath.length; lvIdx++) {
            const pValCell = pipsRow.getCell(lvIdx + 2);
            applyCellBorder(pValCell, 'FFA9D18E');
            pValCell.alignment = { horizontal: 'center', vertical: 'middle' };
            pValCell.font = { bold: true, size: 9.5, color: { argb: 'FF1E4620' }, name: 'Calibri' };
            pValCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };
            pValCell.value = fullMarkupHolds[lvIdx] || 0;
          }

          currentRow = r + 3;
        }

        currentRow += 1;
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer as any as Buffer;
  }
}
