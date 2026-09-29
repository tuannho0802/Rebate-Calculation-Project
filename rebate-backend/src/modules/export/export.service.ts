import * as ExcelJS from 'exceljs';
import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RebateService, MAX_PIPS } from '../rebate/rebate.service';
import { RebateSimulatorService, SimulatorNodeInput } from '../rebate/rebate-simulator.service';

@Injectable()
export class ExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rebateService: RebateService,
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
   * XUẤT FILE EXCEL CHUẨN MA TRẬN KHỐI 15 CỘT THEO FILE MẪU
   * Bảng tính không có tiêu đề (2).xlsx:
   * - Cột 1: Tên sản phẩm
   * - Cột 2..11: 10 cột cấp bậc IB (MIB level 1, level 2... cấp 10)
   * - Cột 12: Công thức kiểm tra =IF(MaxPips=SUM(Levels),"Y",IF(MaxPips>SUM(Levels),"L","N"))
   * - Cột 13: can / no (cho phép markup hay không, no có nền xám)
   * - Cột 14: maximum Pips (chữ đỏ)
   * - Cột 15: Cột trống phân cách giữa các block ngang
   * - Khối dàn ngang từ Block 1 (chỉ MIB) đến Block K (đầy đủ nhánh lá)
   * - Bảng phụ Markup Option ở cuối mỗi block
   */
  async generateCustomTreeRebateExcel(rootIbId?: string, targetAccountType?: string): Promise<Buffer> {
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
      mibRoots = allNodes.filter(
        (n) => (n.level === 0 || !n.parentId) && n.role === 'IB' && n.isActive && (!n.isRootAdmin || (childrenMap.get(n.id)?.length || 0) > 0),
      );
      if (mibRoots.length === 0) {
        mibRoots = allNodes.filter((n) => (n.level === 0 || !n.parentId) && n.role === 'IB' && n.isActive);
      }
    }
    if (mibRoots.length === 0 && allNodes.length > 0) {
      const activeIbNodes = allNodes.filter((n) => n.role === 'IB' && n.isActive);
      if (activeIbNodes.length > 0) {
        mibRoots = [activeIbNodes[0]];
      } else {
        mibRoots = [allNodes[0]];
      }
    }

    // 1. Danh sách 18 sản phẩm chuẩn 100% khớp file mẫu gốc Bảng tính không có tiêu đề (2).xlsx
    const TEMPLATE_PRODUCTS = [
      { symbol: 'D_FOREX', label: 'D Forex', allowMarkup: true, defaultMax: 12 },
      { symbol: 'FOREX', label: 'Forex', allowMarkup: true, defaultMax: 12 },
      { symbol: 'GOLD', label: 'Gold', allowMarkup: true, defaultMax: 20 },
      { symbol: 'SILVER_5000', label: 'Silver 5000OZ', allowMarkup: true, defaultMax: 80 },
      { symbol: 'SILVER_1000', label: 'Silver 1000OZ', allowMarkup: true, defaultMax: 20 },
      { symbol: 'OIL', label: 'Oil', allowMarkup: true, defaultMax: 20 },
      { symbol: 'NATURE_GAS', label: 'Nature Gas', allowMarkup: false, defaultMax: 35 },
      { symbol: 'COMMODITIES', label: 'Index', allowMarkup: false, defaultMax: 5 },
      { symbol: 'HKG50', label: 'HKG50', allowMarkup: false, defaultMax: 5 },
      { symbol: 'A50', label: 'A50', allowMarkup: false, defaultMax: 5 },
      { symbol: 'JPN225', label: 'JPN225', allowMarkup: false, defaultMax: 5 },
      { symbol: 'US_INDEX', label: 'US Index', allowMarkup: false, defaultMax: 5 },
      { symbol: 'SHARES', label: 'Shares', allowMarkup: false, defaultMax: 1.5 },
      { symbol: 'ETHEREUM', label: 'Ethereum', allowMarkup: false, defaultMax: 3 },
      { symbol: 'PRECIOUS_METAL', label: 'Precious Metal', allowMarkup: false, defaultMax: 20 },
      { symbol: 'BITCOIN', label: 'Bitcoin', allowMarkup: false, defaultMax: 3 },
      { symbol: 'CRYPTO', label: 'Crypto', allowMarkup: false, defaultMax: 1.5 },
      { symbol: 'GAUCNH', label: 'GAUCNH', allowMarkup: true, defaultMax: 7 },
    ];

    const dbProducts = await this.prisma.product.findMany({
      where: { isActive: true },
      orderBy: [{ order: 'asc' }, { symbol: 'asc' }],
    });
    const dbProductMap = new Map(dbProducts.map((p) => [p.symbol, p]));

    // Match 18 sản phẩm chuẩn theo template gốc, đồng thời đồng bộ cấu hình động (allowMarkup, defaultMax) từ database / trang Config
    const products = TEMPLATE_PRODUCTS.map((tp) => {
      const dbP = dbProductMap.get(tp.symbol);
      return {
        symbol: tp.symbol,
        label: tp.label,
        allowMarkup: dbP ? (dbP.allowMarkup ?? tp.allowMarkup) : tp.allowMarkup,
        defaultMax: dbP ? Number(dbP.defaultMax) : tp.defaultMax,
      };
    });

    // Thêm các sản phẩm active mới trong DB nếu chưa có trong TEMPLATE_PRODUCTS
    for (const dbP of dbProducts) {
      if (!products.some((p) => p.symbol === dbP.symbol)) {
        products.push({
          symbol: dbP.symbol,
          label: dbP.name || dbP.symbol,
          allowMarkup: dbP.allowMarkup ?? true,
          defaultMax: Number(dbP.defaultMax) || 12,
        });
      }
    }

    const allowMarkupMap = new Map(products.map((p) => [p.symbol, p.allowMarkup]));

    // 2. Định nghĩa Phong cách (Styles) chuẩn 100% file mẫu
    const FONT_FAMILY = 'Times New Roman';
    const COLOR_RED = 'FFFF0000';
    const COLOR_BLACK = 'FF000000';
    const BG_HEADER_BLUE = 'FFB8CCE4';
    const BG_YELLOW = 'FFFFFF00';
    const BG_DATA_PEACH = 'FFFDE9D9';
    const BG_NO_MARKUP = 'FFDDD9C3';

    const applyThinBorder = (cell: ExcelJS.Cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: COLOR_BLACK } },
        left: { style: 'thin', color: { argb: COLOR_BLACK } },
        bottom: { style: 'thin', color: { argb: COLOR_BLACK } },
        right: { style: 'thin', color: { argb: COLOR_BLACK } },
      };
    };

    const getColumnLetter = (colNumber: number): string => {
      let letter = '';
      let temp = colNumber;
      while (temp > 0) {
        const mod = (temp - 1) % 26;
        letter = String.fromCharCode(65 + mod) + letter;
        temp = Math.floor((temp - mod) / 26);
      }
      return letter;
    };

    const nodeHasAccountType = (node: any, accType: string): boolean => {
      if (!node) return false;
      // Root MIB (level 0) luôn có toàn quyền trên mọi loại link
      if (node.level === 0 || !node.parentId) return true;
      if (Array.isArray(node.accountTypes) && node.accountTypes.length > 0) {
        if (node.accountTypes.includes(accType)) return true;
      }
      if (node.accountType && node.accountType === accType) return true;
      if (accType === 'STD' && (!node.accountTypes || node.accountTypes.length === 0)) return true;
      if (Array.isArray(node.rebateConfig)) {
        const hasConfig = node.rebateConfig.some(
          (c: any) => c.accountType === accType && (Number(c.rebatePips) > 0 || Number(c.markupPips) > 0),
        );
        if (hasConfig) return true;
      }
      return false;
    };

    const parseAccountTypePips = (accType?: string): number => {
      if (!accType || accType === 'STD') return 0;
      const match = accType.match(/(\d+(?:\.\d+)?)/);
      if (match) {
        const num = parseFloat(match[1]);
        return isNaN(num) ? 0 : num;
      }
      return 0;
    };

    const getLeafBranches = (nodeId: string, currentPath: any[] = []): any[][] => {
      const node = nodeMap.get(nodeId);
      if (!node) return [];
      const path = [...currentPath, node];
      const children = childrenMap.get(nodeId) || [];
      if (children.length === 0) return [path];
      let branches: any[][] = [];
      for (const child of children) {
        branches.push(...getLeafBranches(child.id, path));
      }
      return branches;
    };

    const filterMaximalBranches = (branches: any[][]): any[][] => {
      const uniqueMap = new Map<string, any[]>();
      for (const b of branches) {
        const key = b.map((n) => n.id).join('->');
        if (!uniqueMap.has(key)) uniqueMap.set(key, b);
      }
      const unique = Array.from(uniqueMap.values());
      return unique.filter((b1) => {
        const key1 = b1.map((n) => n.id).join('->');
        const isPrefix = unique.some((b2) => {
          const key2 = b2.map((n) => n.id).join('->');
          return key2 !== key1 && key2.startsWith(key1 + '->');
        });
        return !isPrefix;
      });
    };

    const setupSheetColumns = (ws: ExcelJS.Worksheet) => {
      for (let b = 0; b < 7; b++) {
        const startC = b * 15 + 1;
        ws.getColumn(startC).width = 16;
        for (let c = 1; c <= 10; c++) {
          ws.getColumn(startC + c).width = 12;
        }
        ws.getColumn(startC + 11).width = 10;
        ws.getColumn(startC + 12).width = 10;
        ws.getColumn(startC + 13).width = 14;
        ws.getColumn(startC + 14).width = 4; // separator gap
      }
    };

    const LEVEL_LABELS = ['MIB level 1', 'level 2', 'level 3', 'level 4', 'level 5', 'Sub 5'];

    const renderBranchAccountTypeTable = async (
      targetSheet: ExcelJS.Worksheet,
      baseRow: number,
      accType: string,
      eligibleBranch: any[],
    ): Promise<number> => {
      const K = eligibleBranch.length;
      const totalMarkupPips = parseAccountTypePips(accType);

      // Thu thập cấu hình DB của các node trong nhánh
      const nodeConfigsMap: Record<string, any> = {};
      await Promise.all(
        eligibleBranch.map(async (node) => {
          nodeConfigsMap[node.id] = await this.rebateService.getConfig(node.id, accType);
        }),
      );

      const getRebatePips = (ibId: string | null | undefined, assetSymbol: string): number => {
        if (!ibId) return 0;
        const cfg = nodeConfigsMap[ibId]?.assets?.find((a: any) => a.assetType === assetSymbol);
        return Number(cfg?.rebatePips || 0);
      };

      // 1. TÍNH TOÁN PHÂN BỔ TOÀN BỘ NHÁNH ĐẦY ĐỦ (FULL BRANCH STAIRCASE)
      const fullSolverInput: SimulatorNodeInput[] = eligibleBranch.map((node, idx) => {
        const isRoot = idx === 0;
        const name = node.name || node.email;
        const lvl = isRoot ? 0 : idx;
        const assets: Record<string, number> = {};

        products.forEach((prod) => {
          const isAllowed = (allowMarkupMap.get(prod.symbol) ?? true) && totalMarkupPips > 0;
          const assetMarkup = isAllowed ? totalMarkupPips : 0;
          if (isRoot) {
            const mibAssetConfig = nodeConfigsMap[node.id]?.assets?.find((a: any) => a.assetType === prod.symbol);
            const mibBaseCap = Number(mibAssetConfig?.maxPips || 0) > 0 ? Number(mibAssetConfig?.maxPips) : prod.defaultMax;
            assets[prod.symbol] = mibBaseCap > 0 ? mibBaseCap + assetMarkup : 0;
          } else {
            const cfg = nodeConfigsMap[node.id]?.assets?.find((a: any) => a.assetType === prod.symbol);
            assets[prod.symbol] = Number(cfg?.rebatePips || 0);
          }
        });

        return { nodeId: node.id, nodeName: name, level: lvl, assets };
      });

      const fullScenarios = this.rebateSimulatorService.solveBallAllocation(
        fullSolverInput,
        totalMarkupPips,
        products.map((p) => p.symbol),
      );

      const savedPatternKey = eligibleBranch.map((node) => {
        const cfg = nodeConfigsMap[node.id]?.assets?.[0];
        return cfg?.markupPips !== undefined && cfg?.markupPips !== null ? Number(cfg.markupPips) : null;
      });

      let activeScenarioIndex = 0;
      if (fullScenarios.length > 0) {
        const isSavedPatternValid = savedPatternKey.every((p) => p !== null);
        if (isSavedPatternValid) {
          const foundIdx = fullScenarios.findIndex((sc) =>
            sc.nodes.every((n, i) => n.white_hold === savedPatternKey[i]),
          );
          if (foundIdx !== -1) activeScenarioIndex = foundIdx;
        }
      }

      const activeScenario = fullScenarios[activeScenarioIndex] || fullScenarios[0];
      const scenarioMap: Record<string, { pct: string; white_hold: number }> = {};
      if (activeScenario) {
        activeScenario.nodes.forEach((n) => {
          scenarioMap[n.nodeId] = { pct: n.pct, white_hold: n.white_hold };
        });
      }

      // Thu thập giá trị markupPips đã lưu trong DB của các sub-IBs (idx >= 1)
      const dbMarkupHolds = eligibleBranch.map((node, idx) => {
        if (idx === 0) return 0;
        const cfg = nodeConfigsMap[node.id]?.assets?.find((a: any) => a.markupPips !== undefined && a.markupPips !== null)
          || nodeConfigsMap[node.id]?.assets?.[0];
        return (cfg?.markupPips !== undefined && cfg?.markupPips !== null) ? Number(cfg.markupPips) : 0;
      });
      const dbSubSum = dbMarkupHolds.slice(1).reduce((a, b) => a + b, 0);
      const hasSavedMarkup = dbSubSum > 0 && dbSubSum <= totalMarkupPips;

      const fullBranchMarkupHolds: number[] = eligibleBranch.map((node, idx) => {
        if (idx >= 1) {
          if (hasSavedMarkup) {
            return dbMarkupHolds[idx];
          }
          if (scenarioMap[node.id]) {
            return scenarioMap[node.id].white_hold;
          }
          return 0;
        }
        return 0;
      });

      const subIbsHoldSum = fullBranchMarkupHolds.slice(1).reduce((a, b) => a + b, 0);
      fullBranchMarkupHolds[0] = Math.max(0, totalMarkupPips - subIbsHoldSum);

      // Markup nhận được tại từng cấp (để trừ ra rebate thuần chính xác)
      const markupReceived = new Array(K).fill(0);
      markupReceived[0] = totalMarkupPips;
      for (let i = 1; i < K; i++) {
        markupReceived[i] = Math.max(0, markupReceived[i - 1] - fullBranchMarkupHolds[i - 1]);
      }

      // 2. TÍNH SỐ REBATE THUẦN (PURE REBATE) GIỮ LẠI CỦA TỪNG CẤP TRONG NHÁNH ĐẦY ĐỦ
      // Bằng cách lấy số Pip thực nhận trừ đi số Markup Pip nhận được ở từng cấp
      const fullBranchPureRetained: Record<string, number[]> = {};
      for (const prod of products) {
        const isAllowed = (allowMarkupMap.get(prod.symbol) ?? true) && totalMarkupPips > 0;
        const mibAssetConfig = nodeConfigsMap[eligibleBranch[0].id]?.assets?.find((a: any) => a.assetType === prod.symbol);
        const mibBaseCap = Number(mibAssetConfig?.maxPips || 0) > 0 ? Number(mibAssetConfig?.maxPips) : prod.defaultMax;
        const mibTotalCap = mibBaseCap + (isAllowed ? totalMarkupPips : 0);

        const webReceived: number[] = new Array(K).fill(0);
        webReceived[0] = mibTotalCap;
        for (let i = 1; i < K; i++) {
          webReceived[i] = getRebatePips(eligibleBranch[i].id, prod.symbol);
        }

        // Tính pureReceived (Rebate thuần nhận được của từng node)
        const pureReceived = new Array(K).fill(0);
        pureReceived[0] = mibBaseCap;
        if (K > 1 && webReceived[1] === 0) {
          // MIB chưa phân bổ sản phẩm này cho cấp dưới: MIB giữ trọn baseCap, cấp dưới 0
          for (let i = 1; i < K; i++) pureReceived[i] = 0;
        } else {
          for (let i = 1; i < K; i++) {
            const mRec = isAllowed ? markupReceived[i] : 0;
            const pRec = Math.max(0, Math.round((webReceived[i] - mRec) * 10000) / 10000);
            pureReceived[i] = Math.min(pureReceived[i - 1], pRec);
          }
        }

        // Tính pureRetained (Rebate thuần giữ lại của từng node)
        const pureRetained: number[] = new Array(K).fill(0);
        for (let i = 0; i < K; i++) {
          if (i < K - 1) {
            pureRetained[i] = Math.max(0, Math.round((pureReceived[i] - pureReceived[i + 1]) * 10000) / 10000);
          } else {
            pureRetained[i] = pureReceived[i];
          }
        }
        fullBranchPureRetained[prod.symbol] = pureRetained;
      }

      // VÒNG LẶP DÀN NGANG CÁC BLOCK (Block 1..K) THEO QUY TẮC BẬC THANG
      for (let bIdx = 0; bIdx < K; bIdx++) {
        const prefixPath = eligibleBranch.slice(0, bIdx + 1);
        const prefixLen = prefixPath.length;
        const colStart = bIdx * 15 + 1;

        // 3. QUY TẮC BẬC THANG CHO MARKUP TRONG BLOCK HIỆN TẠI
        const blockMarkupPips: number[] = new Array(prefixLen).fill(0);
        for (let i = 0; i < prefixLen; i++) {
          if (i < prefixLen - 1) {
            blockMarkupPips[i] = fullBranchMarkupHolds[i];
          } else {
            const prevSum = blockMarkupPips.slice(0, i).reduce((sum, v) => sum + v, 0);
            blockMarkupPips[i] = Math.max(0, totalMarkupPips - prevSum);
          }
        }

        let currentWhiteIn = totalMarkupPips;
        const blockPctNums: number[] = new Array(prefixLen).fill(0);
        for (let i = 0; i < prefixLen; i++) {
          const hold = blockMarkupPips[i];
          const pctVal = currentWhiteIn > 0 ? hold / currentWhiteIn : (i === 0 ? 1 : 0);
          blockPctNums[i] = pctVal;
          currentWhiteIn = Math.max(0, currentWhiteIn - hold);
        }

        // 4. QUY TẮC BẬC THANG CHO REBATE THUẦN TRONG BLOCK HIỆN TẠI (GIỐNG BẢNG MARKUP PIP)
        const retainedMap: Record<string, number[]> = {};
        for (const prod of products) {
          const pureArr = fullBranchPureRetained[prod.symbol];
          const mibAssetConfig = nodeConfigsMap[eligibleBranch[0].id]?.assets?.find((a: any) => a.assetType === prod.symbol);
          const mibBaseCap = Number(mibAssetConfig?.maxPips || 0) > 0 ? Number(mibAssetConfig?.maxPips) : prod.defaultMax;

          const blockRebatePips: number[] = new Array(prefixLen).fill(0);
          for (let i = 0; i < prefixLen; i++) {
            if (i < prefixLen - 1) {
              blockRebatePips[i] = pureArr[i];
            } else {
              const prevSum = blockRebatePips.slice(0, i).reduce((sum, v) => sum + v, 0);
              blockRebatePips[i] = Math.max(0, Math.round((mibBaseCap - prevSum) * 10000) / 10000);
            }
          }
          retainedMap[prod.symbol] = blockRebatePips;
        }

        // === 1. DÒNG LEVEL HEADER (baseRow) ===
        const headerRow = targetSheet.getRow(baseRow);
        headerRow.height = 24;

        for (let i = 0; i < 6; i++) {
          const cCell = headerRow.getCell(colStart + 1 + i);
          cCell.value = LEVEL_LABELS[i];
          cCell.font = { name: FONT_FAMILY, bold: true, size: 11, color: { argb: COLOR_RED } };
          cCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BG_HEADER_BLUE } };
          cCell.alignment = { horizontal: 'center', vertical: 'middle' };
          applyThinBorder(cCell);
        }

        targetSheet.mergeCells(baseRow, colStart + 11, baseRow, colStart + 13);
        const legendCell = targetSheet.getCell(baseRow, colStart + 11);
        legendCell.value = {
          richText: [
            { font: { name: FONT_FAMILY, bold: true, size: 11, color: { argb: COLOR_RED } }, text: 'N = No\n ' },
            { font: { name: FONT_FAMILY, bold: true, size: 11, color: { argb: COLOR_BLACK } }, text: 'Y = Yes\n' },
            { font: { name: FONT_FAMILY, bold: true, size: 11, color: { argb: COLOR_RED } }, text: ' ' },
            { font: { name: FONT_FAMILY, bold: true, size: 11, color: { argb: 'FF92D050' } }, text: 'L= to be confirmed' },
          ],
        };
        legendCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        applyThinBorder(legendCell);
        applyThinBorder(targetSheet.getCell(baseRow, colStart + 12));
        applyThinBorder(targetSheet.getCell(baseRow, colStart + 13));

        // === 2. DÒNG EMAIL (baseRow + 2) ===
        const emailRow = targetSheet.getRow(baseRow + 2);
        emailRow.height = 20;
        for (let i = 0; i < prefixLen; i++) {
          const eCell = emailRow.getCell(colStart + 1 + i);
          eCell.value = prefixPath[i].email;
          eCell.font = { name: FONT_FAMILY, bold: true, size: 11, color: { argb: 'FF222222' } };
          eCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BG_YELLOW } };
          eCell.alignment = { horizontal: 'center', vertical: 'middle' };
          applyThinBorder(eCell);
        }

        // === 3. DÒNG TIÊU ĐỀ MAXIMUM PIPS (baseRow + 4) ===
        const maxTitleRow = targetSheet.getRow(baseRow + 4);
        const mtCell = maxTitleRow.getCell(colStart + 13);
        mtCell.value = 'maximum Pips';
        mtCell.font = { name: FONT_FAMILY, bold: true, size: 11, color: { argb: COLOR_RED } };
        mtCell.alignment = { horizontal: 'center', vertical: 'middle' };
        applyThinBorder(mtCell);

        // === 4. DÒNG REBATE HEADER (baseRow + 5) ===
        const rebRow = targetSheet.getRow(baseRow + 5);
        rebRow.height = 20;
        const rHCell = rebRow.getCell(colStart);
        rHCell.value = 'Rebate (pips) ';
        rHCell.font = { name: FONT_FAMILY, bold: true, size: 11, color: { argb: COLOR_BLACK } };
        rHCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BG_YELLOW } };
        rHCell.alignment = { horizontal: 'center', vertical: 'middle' };
        applyThinBorder(rHCell);

        const rMaxCell = rebRow.getCell(colStart + 13);
        rMaxCell.value = 'maximum Pips';
        rMaxCell.font = { name: FONT_FAMILY, bold: true, size: 11, color: { argb: COLOR_RED } };
        rMaxCell.alignment = { horizontal: 'center', vertical: 'middle' };
        applyThinBorder(rMaxCell);

        // === 5. 18 DÒNG SẢN PHẨM (baseRow + 6 .. baseRow + 23) ===
        for (let pIdx = 0; pIdx < products.length; pIdx++) {
          const prod = products[pIdx];
          const r = baseRow + 6 + pIdx;
          const dataRow = targetSheet.getRow(r);
          dataRow.height = 19;

          // Cột 1: Tên sản phẩm
          const pCell = dataRow.getCell(colStart);
          pCell.value = prod.label;
          pCell.font = { name: FONT_FAMILY, bold: true, size: 11, color: { argb: COLOR_BLACK } };
          pCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BG_DATA_PEACH } };
          pCell.alignment = { horizontal: 'center', vertical: 'middle' };
          applyThinBorder(pCell);

          // 10 Cột cấp bậc IB
          const retainedArr = retainedMap[prod.symbol] || [];
          for (let c = 1; c <= 10; c++) {
            const valCell = dataRow.getCell(colStart + c);
            if (c <= prefixLen) {
              valCell.value = retainedArr[c - 1] ?? 0;
            } else {
              valCell.value = null;
            }
            valCell.font = { name: FONT_FAMILY, bold: true, size: 11, color: { argb: COLOR_BLACK } };
            valCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BG_DATA_PEACH } };
            valCell.alignment = { horizontal: 'center', vertical: 'middle' };
            applyThinBorder(valCell);
          }

          // Cột 12: Công thức Excel động
          const maxColLetter = getColumnLetter(colStart + 13);
          const startColLetter = getColumnLetter(colStart + 1);
          const endColLetter = getColumnLetter(colStart + 10);
          const maxCellAddr = `${maxColLetter}${r}`;
          const formulaStr = `IF(${maxCellAddr}=SUM(${startColLetter}${r}:${endColLetter}${r}),"Y",IF(${maxCellAddr}>SUM(${startColLetter}${r}:${endColLetter}${r}),"L","N"))`;

          const currentSum = Math.round(retainedArr.reduce((sum, v) => sum + (v || 0), 0) * 10000) / 10000;
          const mibAssetCfg = nodeConfigsMap[eligibleBranch[0].id]?.assets?.find((a: any) => a.assetType === prod.symbol);
          const mibBaseCap = Number(mibAssetCfg?.maxPips || 0) > 0 ? Number(mibAssetCfg?.maxPips) : prod.defaultMax;
          const maxVal = mibBaseCap;

          let calcResult = 'Y';
          if (Math.abs(currentSum - maxVal) < 0.0001) {
            calcResult = 'Y';
          } else if (maxVal > currentSum) {
            calcResult = 'L';
          } else {
            calcResult = 'N';
          }

          const statusCell = dataRow.getCell(colStart + 11);
          statusCell.value = {
            formula: formulaStr,
            result: calcResult,
          };
          statusCell.font = { name: FONT_FAMILY, bold: true, size: 11, color: { argb: COLOR_BLACK } };
          statusCell.alignment = { horizontal: 'center', vertical: 'middle' };
          applyThinBorder(statusCell);

          // Cột 13: can / no
          const isAllowed = prod.allowMarkup;
          const markupCell = dataRow.getCell(colStart + 12);
          markupCell.value = isAllowed ? 'can' : 'no';
          markupCell.font = { name: FONT_FAMILY, size: 11, color: { argb: COLOR_BLACK } };
          if (!isAllowed) {
            markupCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BG_NO_MARKUP } };
          }
          markupCell.alignment = { horizontal: 'center', vertical: 'middle' };
          applyThinBorder(markupCell);

          // Cột 14: maximum Pips
          const maxValCell = dataRow.getCell(colStart + 13);
          maxValCell.value = maxVal;
          maxValCell.font = { name: FONT_FAMILY, bold: true, size: 11, color: { argb: COLOR_RED } };
          maxValCell.alignment = { horizontal: 'center', vertical: 'middle' };
          applyThinBorder(maxValCell);
        }

        // === 6. BẢNG PHỤ MARKUP OPTION ===
        const mOptionHeaderRowNum = baseRow + 6 + products.length + 1;
        const mOptionRow = targetSheet.getRow(mOptionHeaderRowNum);
        mOptionRow.height = 20;
        const mOptCell = mOptionRow.getCell(colStart);
        mOptCell.value = 'Markup Option';
        mOptCell.font = { name: FONT_FAMILY, bold: true, size: 11, color: { argb: COLOR_BLACK } };
        mOptCell.alignment = { horizontal: 'center', vertical: 'middle' };
        applyThinBorder(mOptCell);

        for (let i = 0; i < 6; i++) {
          const mLevelCell = mOptionRow.getCell(colStart + 1 + i);
          mLevelCell.value = LEVEL_LABELS[i];
          mLevelCell.font = { name: FONT_FAMILY, bold: true, size: 11, color: { argb: COLOR_RED } };
          mLevelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BG_HEADER_BLUE } };
          mLevelCell.alignment = { horizontal: 'center', vertical: 'middle' };
          applyThinBorder(mLevelCell);
        }

        // Dòng Pips Markup giữ lại
        const pipsRow = targetSheet.getRow(mOptionHeaderRowNum + 1);
        pipsRow.height = 19;
        for (let i = 0; i < 6; i++) {
          const pHoldCell = pipsRow.getCell(colStart + 1 + i);
          if (i < prefixLen) {
            pHoldCell.value = blockMarkupPips[i] ?? 0;
          } else {
            pHoldCell.value = null;
          }
          pHoldCell.font = { name: FONT_FAMILY, bold: true, size: 11, color: { argb: COLOR_BLACK } };
          pHoldCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BG_DATA_PEACH } };
          pHoldCell.alignment = { horizontal: 'center', vertical: 'middle' };
          applyThinBorder(pHoldCell);
        }

        // Dòng % Giữ lại
        const pctRow = targetSheet.getRow(mOptionHeaderRowNum + 2);
        pctRow.height = 19;
        const totalPipsCell = pctRow.getCell(colStart);
        totalPipsCell.value = totalMarkupPips;
        totalPipsCell.font = { name: FONT_FAMILY, bold: true, size: 11, color: { argb: COLOR_BLACK } };
        totalPipsCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BG_DATA_PEACH } };
        totalPipsCell.alignment = { horizontal: 'center', vertical: 'middle' };
        applyThinBorder(totalPipsCell);

        for (let i = 0; i < 6; i++) {
          const pctCell = pctRow.getCell(colStart + 1 + i);
          if (i < prefixLen) {
            pctCell.value = blockPctNums[i] ?? 0;
            pctCell.numFmt = '0%';
          } else {
            pctCell.value = null;
          }
          pctCell.font = { name: FONT_FAMILY, bold: true, size: 11, color: { argb: COLOR_BLACK } };
          pctCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BG_DATA_PEACH } };
          pctCell.alignment = { horizontal: 'center', vertical: 'middle' };
          applyThinBorder(pctCell);
        }
      }

      // Cách 2 dòng trống trước bảng kế tiếp
      return baseRow + 6 + products.length + 5;
    };

    // 3. Khởi tạo Workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Rebate Management System';
    workbook.created = new Date();
    const usedSheetNames = new Set<string>();

    // Thu thập danh sách Loại tài khoản xuất hiện trong hệ thống
    const priorityOrder = ['STD', 'STD5', 'STD10', 'STD15', 'STD20'];
    const allAccountTypesSet = new Set<string>(priorityOrder);

    allNodes.forEach((n) => {
      if (n.accountType) allAccountTypesSet.add(n.accountType);
      if (Array.isArray(n.accountTypes)) {
        n.accountTypes.forEach((at: string) => allAccountTypesSet.add(at));
      }
      if (Array.isArray(n.rebateConfig)) {
        n.rebateConfig.forEach((c: any) => {
          if (c.accountType && (Number(c.rebatePips) > 0 || Number(c.markupPips) > 0)) {
            allAccountTypesSet.add(c.accountType);
          }
        });
      }
    });

    const allAccountTypes = Array.from(allAccountTypesSet).filter(Boolean);
    allAccountTypes.sort((a, b) => {
      const idxA = priorityOrder.indexOf(a);
      const idxB = priorityOrder.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });

    const candidateAccountTypes = targetAccountType && targetAccountType !== 'ALL'
      ? [targetAccountType]
      : allAccountTypes;

    // VÒNG LẶP QUA TỪNG MIB ROOT
    for (let mibIdx = 0; mibIdx < mibRoots.length; mibIdx++) {
      const rootNode = mibRoots[mibIdx];
      const leafBranches = getLeafBranches(rootNode.id);
      const allBranches = filterMaximalBranches(leafBranches);

      // 1. TẠO DUY NHẤT 1 SHEET CHO MIB (CHỈ ĐẶT THEO TÊN MIB)
      const cleanBaseName = (rootNode.name || rootNode.email.split('@')[0])
        .replace(/[:\\/?*\[\]]/g, '')
        .trim()
        .slice(0, 28) || 'MIB';

      let sheetName = cleanBaseName;
      let counter = 1;
      while (usedSheetNames.has(sheetName.toLowerCase())) {
        sheetName = `${cleanBaseName.slice(0, 24)} (${counter++})`;
      }
      usedSheetNames.add(sheetName.toLowerCase());

      const masterSheet = workbook.addWorksheet(sheetName, {
        views: [{ showGridLines: true }],
      });
      setupSheetColumns(masterSheet);

      let currentBaseRow = 1;

      // VÒNG LẶP NGOÀI: TỪNG NHÁNH
      for (let branchIdx = 0; branchIdx < allBranches.length; branchIdx++) {
        const currentBranch = allBranches[branchIdx];

        // Giữ đầy đủ tất cả loại account type và toàn bộ các cấp trong nhánh
        const validAccTypes = candidateAccountTypes;

        if (validAccTypes.length === 0) continue;

        // BANNER TÊN NHÁNH
        const maxColsForBranch = Math.min(74, Math.max(14, currentBranch.length * 15 - 1));
        masterSheet.mergeCells(currentBaseRow, 1, currentBaseRow, maxColsForBranch);
        const branchBanner = masterSheet.getCell(currentBaseRow, 1);
        const branchPathStr = currentBranch.map((n) => (n.name ? `${n.name} (${n.email})` : n.email)).join(' ➔ ');
        branchBanner.value = `Nhánh ${branchIdx + 1}: ${branchPathStr}`;
        branchBanner.font = { name: FONT_FAMILY, bold: true, size: 12, color: { argb: 'FF1F3864' } };
        branchBanner.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
        branchBanner.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
        masterSheet.getRow(currentBaseRow).height = 24;
        for (let c = 1; c <= maxColsForBranch; c++) applyThinBorder(masterSheet.getCell(currentBaseRow, c));
        currentBaseRow += 2;

        // VÒNG LẶP TRONG: TỪNG LOẠI LINK TRONG NHÁNH NÀY (STD, STD5, STD10, ...)
        for (let accIdx = 0; accIdx < validAccTypes.length; accIdx++) {
          const accType = validAccTypes[accIdx];
          const totalMarkupPips = parseAccountTypePips(accType);
          const eligibleBranch = currentBranch;

          // BANNER TIÊU ĐỀ LOẠI LINK MARKUP
          const maxColsForCategory = Math.min(74, Math.max(14, eligibleBranch.length * 15 - 1));
          masterSheet.mergeCells(currentBaseRow, 1, currentBaseRow, maxColsForCategory);
          const categoryBanner = masterSheet.getCell(currentBaseRow, 1);
          categoryBanner.value = `▶ LOẠI LINK MARKUP: ${accType} (Cộng thêm: ${totalMarkupPips} Pips)`;
          categoryBanner.font = { name: FONT_FAMILY, bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
          categoryBanner.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3864' } };
          categoryBanner.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
          masterSheet.getRow(currentBaseRow).height = 22;
          for (let c = 1; c <= maxColsForCategory; c++) applyThinBorder(masterSheet.getCell(currentBaseRow, c));
          currentBaseRow += 2;

          // RENDER BẢNG DỮ LIỆU BẬC THANG
          currentBaseRow = await renderBranchAccountTypeTable(masterSheet, currentBaseRow, accType, eligibleBranch);
        }

        // Cách 1 dòng trống trước nhánh tiếp theo
        currentBaseRow += 1;
      }
    }

    if (workbook.worksheets.length === 0) {
      workbook.addWorksheet('MIB Report', { views: [{ showGridLines: true }] });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer as any as Buffer;
  }
}

