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
   * TÍNH TOÁN XUẤT EXCEL CHUẨN TẤT CẢ LOẠI TÀI KHOẢN VÀ MỌI BẢNG LŨY TIẾN
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
      { key: 'D_FOREX',        label: 'D Forex (Pips)',       maxPips: 12   },
      { key: 'FOREX',          label: 'Forex (Pips)',          maxPips: 12   },
      { key: 'GOLD',           label: 'Gold (Pips)',           maxPips: 20   },
      { key: 'SILVER_5000',    label: 'Silver 5000OZ (Pips)', maxPips: 80   },
      { key: 'SILVER_1000',    label: 'Silver 1000OZ (Pips)', maxPips: 20   },
      { key: 'OIL',            label: 'Oil (Pips)',            maxPips: 20   },
      { key: 'NATURE_GAS',     label: 'Nature Gas (Pips)',     maxPips: 35   },
      { key: 'COMMODITIES',    label: 'Commodities (Pips)',    maxPips: 3    },
      { key: 'HKG50',          label: 'HKG50 (Pips)',          maxPips: 20   },
      { key: 'A50',            label: 'A50 (Pips)',             maxPips: 40   },
      { key: 'JPN225',         label: 'JPN225 (Pips)',          maxPips: 50   },
      { key: 'US_INDEX',       label: 'US Index (Pips)',        maxPips: 2.3  },
      { key: 'SHARES',         label: 'Shares',                maxPips: 1.5  },
      { key: 'ETHEREUM',       label: 'Ethereum',              maxPips: 3    },
      { key: 'PRECIOUS_METAL', label: 'Precious Metal',        maxPips: 20   },
      { key: 'BITCOIN',        label: 'Bitcoin',               maxPips: 3    },
      { key: 'CRYPTO',         label: 'Crypto',                maxPips: 1.5  },
      { key: 'GAUCNH',         label: 'GAUCNH',                maxPips: 7    },
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

      // HÀNG 1: EMAIL MIB DẦU SHEET
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

        const maxMergedCols = Math.max(30, branchPath.length * 15);
        sheet.mergeCells(currentRow, 1, currentRow, maxMergedCols);
        for (let c = 1; c <= maxMergedCols; c++) {
          const cCell = titleRow.getCell(c);
          cCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
          applyCellBorder(cCell, 'FF1F4E78');
        }

        currentRow += 2;

        // LẤY TẤT CẢ LOẠI TÀI KHOẢN TRONG NHÁNH
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
          const accSubPath: any[] = branchPath;

          if (accSubPath.length === 0) continue;

          // DYNAMIC LẤY TOTAL MARKUP PIPS CỦA LOẠI TÀI KHOẢN
          let totalMarkupPips = 0;
          const rootConfig = accSubPath[0]?.rebateConfig?.find((c: any) => c.accountType === accType);
          if (rootConfig && rootConfig.markupPips !== undefined && rootConfig.markupPips !== null) {
            totalMarkupPips = Number(rootConfig.markupPips);
          } else {
            const matchPips = accType.match(/(\d+(?:\.\d+)?)/);
            totalMarkupPips = matchPips ? parseFloat(matchPips[1]) : 0;
          }

          // LẤY SỐ PIPS BỊ NÓI TRỞ / GIỮ LẠI CHO CẢ NHÁNH
          const fullBranchSolverInput: SimulatorNodeInput[] = accSubPath.map((node, idx) => {
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
          const fullMarkupHolds: number[] = accSubPath.map((node, idx) => {
            if (fullActiveScenario && fullActiveScenario.nodes && fullActiveScenario.nodes[idx]) {
              return fullActiveScenario.nodes[idx].white_hold;
            }
            const cfgs = node.rebateConfig || [];
            const cfg = cfgs.find((c: any) => c.accountType === accType) || cfgs[0];
            return cfg?.markupPips !== undefined && cfg?.markupPips !== null ? Number(cfg.markupPips) : 0;
          });

          const startRowForAccType = currentRow;
          let maxBlockHeight = 25;

          // VẼ TỪNG BẢNG LŨY TIẾN TƯƠNG ỨNG TỪNG LEVEL
          for (let step = 0; step < accSubPath.length; step++) {
            const stepPath = accSubPath.slice(0, step + 1);
            const startCol = 1 + step * 15;

            sheet.getColumn(startCol).width = 22;
            for (let k = 1; k <= 6; k++) sheet.getColumn(startCol + k).width = 16;
            sheet.getColumn(startCol + 11).width = 8;
            sheet.getColumn(startCol + 12).width = 8;
            sheet.getColumn(startCol + 13).width = 14;
            sheet.getColumn(startCol + 14).width = 3;

            let r = startRowForAccType;

            // 1. Header Level
            const levelHeaderRow = sheet.getRow(r);
            levelHeaderRow.height = 22;
            const levelNames = ['MIB level 1', 'level 2', 'level 3', 'level 4', 'level 5', 'Sub 5'];
            for (let lvIdx = 0; lvIdx < 6; lvIdx++) {
              const lvCell = levelHeaderRow.getCell(startCol + 1 + lvIdx);
              lvCell.value = levelNames[lvIdx];
              lvCell.font = { bold: true, size: 9.5, color: { argb: 'FFFFFFFF' }, name: 'Calibri' };
              lvCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E75B6' } };
              lvCell.alignment = { horizontal: 'center', vertical: 'middle' };
              applyCellBorder(lvCell, 'FF1F3864');
            }

            const legendCell = levelHeaderRow.getCell(startCol + 11);
            legendCell.value = 'N = No\nY = Yes\nL= to be confirmed';
            legendCell.font = { size: 7.5, color: { argb: 'FF595959' }, name: 'Calibri' };
            legendCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F4F7' } };
            legendCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            applyCellBorder(legendCell, 'FFD1D5DB');

            r++;

            // 2. Row Email Path
            const emailSubRow = sheet.getRow(r);
            emailSubRow.height = 20;
            for (let lvIdx = 0; lvIdx < 6; lvIdx++) {
              const cell = emailSubRow.getCell(startCol + 1 + lvIdx);
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
              applyCellBorder(cell, 'FFD69E2E');

              if (lvIdx < stepPath.length) {
                cell.value = stepPath[lvIdx].email;
                cell.font = { bold: true, size: 8.5, color: { argb: 'FF1F4E78' }, name: 'Calibri' };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
              }
            }

            r++;

            // 3. Rebate Label Header
            const pipsHeaderRow = sheet.getRow(r);
            pipsHeaderRow.height = 20;
            const rebateLabelCell = pipsHeaderRow.getCell(startCol);
            rebateLabelCell.value = 'Rebate (pips)';
            rebateLabelCell.font = { bold: true, size: 9.5, color: { argb: 'FFFFFFFF' }, name: 'Calibri' };
            rebateLabelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F5597' } };
            rebateLabelCell.alignment = { horizontal: 'left', vertical: 'middle' };
            applyCellBorder(rebateLabelCell, 'FF1F3864');

            const maxPipsHeaderCell = pipsHeaderRow.getCell(startCol + 13);
            maxPipsHeaderCell.value = 'maximum Pips';
            maxPipsHeaderCell.font = { bold: true, size: 9, color: { argb: 'FFFFFFFF' }, name: 'Calibri' };
            maxPipsHeaderCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F5597' } };
            maxPipsHeaderCell.alignment = { horizontal: 'center', vertical: 'middle' };
            applyCellBorder(maxPipsHeaderCell, 'FF1F3864');

            r++;

            // 4. Data 18 Sản phẩm Rebate
            for (const asset of ASSET_TYPES) {
              const dataRow = sheet.getRow(r);
              dataRow.height = 18;

              const assetLabelCell = dataRow.getCell(startCol);
              assetLabelCell.value = asset.label;
              assetLabelCell.font = { bold: true, size: 9, color: { argb: 'FF1E293B' }, name: 'Calibri' };
              assetLabelCell.alignment = { horizontal: 'left', vertical: 'middle' };
              applyCellBorder(assetLabelCell, 'FFCBD5E1');

              // Lấy Pips gốc cứng từ Config/DB
              const mibNode = stepPath[0];
              const mibAssetConfig = getNodeConfig(mibNode, asset.key, accType);
              const basePips = mibAssetConfig?.maxPips !== undefined && mibAssetConfig?.maxPips !== null
                ? Number(mibAssetConfig.maxPips)
                : asset.maxPips;

              for (let lvIdx = 0; lvIdx < 6; lvIdx++) {
                const pipsCell = dataRow.getCell(startCol + 1 + lvIdx);
                pipsCell.alignment = { horizontal: 'center', vertical: 'middle' };

                if (lvIdx < stepPath.length) {
                  let cellVal = 0;
                  if (lvIdx < step) {
                    // Cấp giữ lại phía trên
                    const cfg = getNodeConfig(stepPath[lvIdx], asset.key, accType);
                    cellVal = cfg?.markupPips !== undefined ? Number(cfg.markupPips) : 0;
                  } else if (lvIdx === step) {
                    // Cấp lá hiện tại = Pips gốc - Tổng giữ lại của cấp trên
                    let prevHolds = 0;
                    for (let p = 0; p < step; p++) {
                      const cfg = getNodeConfig(stepPath[p], asset.key, accType);
                      prevHolds += cfg?.markupPips !== undefined ? Number(cfg.markupPips) : 0;
                    }
                    cellVal = Math.max(0, basePips - prevHolds);
                  }

                  pipsCell.value = cellVal;
                  if (cellVal > 0) {
                    pipsCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };
                    pipsCell.font = { bold: true, size: 9.5, color: { argb: 'FF1E4620' }, name: 'Calibri' };
                    applyCellBorder(pipsCell, 'FFA9D18E');
                  } else {
                    pipsCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
                    pipsCell.font = { size: 8.5, color: { argb: 'FF94A3B8' }, name: 'Calibri' };
                    applyCellBorder(pipsCell, 'FFE2E8F0');
                  }
                } else {
                  pipsCell.value = '';
                  pipsCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
                  applyCellBorder(pipsCell, 'FFE2E8F0');
                }
              }

              // Các cột Flag kiểm tra
              const flagCell = dataRow.getCell(startCol + 11);
              flagCell.value = 'Y';
              flagCell.font = { bold: true, size: 9, color: { argb: 'FF1E4620' }, name: 'Calibri' };
              flagCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };
              flagCell.alignment = { horizontal: 'center', vertical: 'middle' };
              applyCellBorder(flagCell, 'FFA9D18E');

              const statusCell = dataRow.getCell(startCol + 12);
              statusCell.value = 'can';
              statusCell.font = { bold: true, size: 9, color: { argb: 'FF1E4620' }, name: 'Calibri' };
              statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };
              statusCell.alignment = { horizontal: 'center', vertical: 'middle' };
              applyCellBorder(statusCell, 'FFA9D18E');

              const maxLimitCell = dataRow.getCell(startCol + 13);
              maxLimitCell.value = asset.maxPips;
              maxLimitCell.font = { bold: true, size: 9, color: { argb: 'FF1F4E78' }, name: 'Calibri' };
              maxLimitCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDF2F8' } };
              maxLimitCell.alignment = { horizontal: 'center', vertical: 'middle' };
              applyCellBorder(maxLimitCell, 'FFB4C6E7');

              r++;
            }

            // 5. BẢNG MARKUP OPTION (TÍNH TỶ LỆ DYNAMIC VÀ SỐ PIPS CHUẨN)
            r++;

            const markupHeaderRow = sheet.getRow(r);
            markupHeaderRow.height = 20;
            const markupTitleCell = markupHeaderRow.getCell(startCol);
            markupTitleCell.value = 'Markup Option';
            markupTitleCell.font = { bold: true, size: 9, color: { argb: 'FF1F4E78' }, name: 'Calibri' };
            markupTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
            applyCellBorder(markupTitleCell, 'FF8EA9DB');

            for (let lvIdx = 0; lvIdx < 6; lvIdx++) {
              const mCell = markupHeaderRow.getCell(startCol + 1 + lvIdx);
              mCell.value = levelNames[lvIdx];
              mCell.font = { bold: true, size: 8.5, color: { argb: 'FF1F4E78' }, name: 'Calibri' };
              mCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
              mCell.alignment = { horizontal: 'center', vertical: 'middle' };
              applyCellBorder(mCell, 'FF8EA9DB');
            }

            // Row 1 Markup Option: TỶ LỆ % GIỮ LẠI (TÍNH LŨY THỪA TRÊN POOL CÒN LẠI)
            r++;
            const pctRow = sheet.getRow(r);
            pctRow.height = 18;
            const pctLabelCell = pctRow.getCell(startCol);
            pctLabelCell.value = totalMarkupPips > 0 ? `${totalMarkupPips}` : '0';
            pctLabelCell.font = { bold: true, size: 8.5, color: { argb: 'FF7F6000' }, name: 'Calibri' };
            pctLabelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
            applyCellBorder(pctLabelCell, 'FFD69E2E');

            for (let lvIdx = 0; lvIdx < 6; lvIdx++) {
              const pCell = pctRow.getCell(startCol + 1 + lvIdx);
              applyCellBorder(pCell, 'FFD69E2E');
              pCell.alignment = { horizontal: 'center', vertical: 'middle' };
              pCell.font = { bold: true, size: 8.5, color: { argb: 'FF7F6000' }, name: 'Calibri' };
              pCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };

              if (lvIdx < stepPath.length) {
                if (lvIdx < step) {
                  // Pool tại cấp này = Total Markup - Số pips các cấp trước đã giữ
                  let prevHolds = 0;
                  for (let p = 0; p < lvIdx; p++) {
                    prevHolds += fullMarkupHolds[p] || 0;
                  }
                  const currentPool = totalMarkupPips - prevHolds;
                  const holdVal = fullMarkupHolds[lvIdx] || 0;

                  if (currentPool > 0) {
                    const pct = (holdVal / currentPool) * 100;
                    pCell.value = `${Number(pct.toFixed(2))}%`;
                  } else {
                    pCell.value = '0%';
                  }
                } else if (lvIdx === step) {
                  // Cấp cuối cùng hiển thị của bảng này luôn gom toàn bộ còn lại -> 100%
                  pCell.value = '100%';
                }
              } else {
                pCell.value = '';
              }
            }

            // Row 2 Markup Option: SỐ PIPS TƯƠNG ỨNG
            r++;
            const pipsRow = sheet.getRow(r);
            pipsRow.height = 18;
            const pipsLabelCell = pipsRow.getCell(startCol);
            pipsLabelCell.value = `${totalMarkupPips}`;
            pipsLabelCell.font = { bold: true, size: 8.5, color: { argb: 'FF1E4620' }, name: 'Calibri' };
            pipsLabelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };
            applyCellBorder(pipsLabelCell, 'FFA9D18E');

            for (let lvIdx = 0; lvIdx < 6; lvIdx++) {
              const pValCell = pipsRow.getCell(startCol + 1 + lvIdx);
              applyCellBorder(pValCell, 'FFA9D18E');
              pValCell.alignment = { horizontal: 'center', vertical: 'middle' };
              pValCell.font = { bold: true, size: 8.5, color: { argb: 'FF1E4620' }, name: 'Calibri' };
              pValCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };

              if (lvIdx < stepPath.length) {
                if (lvIdx < step) {
                  pValCell.value = fullMarkupHolds[lvIdx] || 0;
                } else if (lvIdx === step) {
                  let prevHolds = 0;
                  for (let p = 0; p < step; p++) {
                    prevHolds += fullMarkupHolds[p] || 0;
                  }
                  pValCell.value = Math.max(0, totalMarkupPips - prevHolds);
                }
              } else {
                pValCell.value = '';
              }
            }

            maxBlockHeight = Math.max(maxBlockHeight, r - startRowForAccType + 1);
          }

          currentRow += maxBlockHeight + 2;
        }

        currentRow += 2;
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer as any as Buffer;
  }
}
