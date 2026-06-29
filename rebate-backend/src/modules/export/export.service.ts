import * as ExcelJS from 'exceljs';
import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ExportService {
  constructor(private readonly prisma: PrismaService) {}

  private async getIbTreeByLevel(rootIbId: string): Promise<Record<number, any[]>> {
    const root = await this.prisma.ibNode.findUnique({
      where: { id: rootIbId },
      include: { rebateConfig: true },
    });
    if (!root) return {};

    const tree: Record<number, any[]> = {};
    const rootLevel = root.level;

    // BFS queue: { id, level }
    const queue: { id: string; level: number }[] = [
      { id: root.id, level: root.level },
    ];

    while (queue.length > 0) {
      const { id, level } = queue.shift()!;
      const depth = level - rootLevel;
      if (depth > 6) continue; // tối đa 6 cấp

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
    const tree = await this.getIbTreeByLevel(rootIbId);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Rebate System';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Rebate Config', {
      views: [{ state: 'frozen', ySplit: 7 }],
    });

    // ── COLORS ──────────────────────────────────────────────────
    const HEADER_BG    = 'FF1F3864'; // Navy blue
    const HEADER_BG2   = 'FF2E75B6'; // Lighter blue
    const YELLOW_BG    = 'FFFFF2CC'; // Soft yellow
    const YELLOW_FONT  = 'FF7F6000'; // Dark gold
    const GREEN_BG     = 'FFE2EFDA'; // Soft green
    const GREEN_FONT   = 'FF375623'; // Dark green
    const PINK_BG      = 'FFFCE4D6'; // Soft orange-pink
    const PINK_FONT    = 'FF833C00'; // Dark brown
    const RED_FONT     = 'FFC00000'; // Deep red
    const WHITE        = 'FFFFFFFF';
    const GRAY_BG      = 'FFF2F2F2'; // Light gray for empty cells
    const SUBHEADER_BG = 'FF4472C4'; // Medium blue

    // ── COLUMN WIDTHS ────────────────────────────────────────────
    const colWidths = [22, 20, 20, 20, 18, 18, 18, 18, 4, 4, 4, 14];
    colWidths.forEach((w, i) => {
      sheet.getColumn(i + 1).width = w;
    });

    // Helper: apply thin border to a cell
    const applyBorder = (cell: ExcelJS.Cell, color = 'FFD9D9D9') => {
      cell.border = {
        top:    { style: 'thin', color: { argb: color } },
        left:   { style: 'thin', color: { argb: color } },
        bottom: { style: 'thin', color: { argb: color } },
        right:  { style: 'thin', color: { argb: color } },
      };
    };

    // ── ROW 1: TITLE ─────────────────────────────────────────────
    sheet.mergeCells('A1:L1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'REBATE CONFIGURATION REPORT';
    titleCell.font = { bold: true, size: 14, color: { argb: WHITE }, name: 'Calibri' };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 28;

    // ── ROW 2: Level labels ───────────────────────────────────────
    const levelLabels = ['', 'MIB (Level 1)', 'Level 2', 'Level 3', 'Level 4', 'Level 5', 'Sub Level 5', '', '', '', '', 'Max Pips'];
    const headerRow = sheet.getRow(2);
    headerRow.height = 22;
    levelLabels.forEach((label, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = label;
      const isFilled = label !== '';
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: isFilled ? SUBHEADER_BG : HEADER_BG },
      };
      cell.font = { bold: true, color: { argb: WHITE }, size: 10, name: 'Calibri' };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      applyBorder(cell, 'FF2F5496');
    });

    // ── ROW 3: Generated date ─────────────────────────────────────
    sheet.mergeCells('A3:L3');
    const dateCell = sheet.getCell('A3');
    dateCell.value = `Generated: ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`;
    dateCell.font = { italic: true, size: 9, color: { argb: 'FF808080' }, name: 'Calibri' };
    dateCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRAY_BG } };
    dateCell.alignment = { horizontal: 'right', vertical: 'middle' };
    sheet.getRow(3).height = 16;

    // ── ROW 4: Blank separator ────────────────────────────────────
    sheet.getRow(4).height = 6;

    // ── ROW 5: EMAIL row header ───────────────────────────────────
    const emailLabelCell = sheet.getRow(5).getCell(1);
    emailLabelCell.value = 'IB Account';
    emailLabelCell.font = { bold: true, size: 10, color: { argb: YELLOW_FONT }, name: 'Calibri' };
    emailLabelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: YELLOW_BG } };
    emailLabelCell.alignment = { horizontal: 'left', vertical: 'middle' };
    applyBorder(emailLabelCell, 'FFBF9000');
    sheet.getRow(5).height = 20;

    for (let i = 0; i <= 6; i++) {
      const cell = sheet.getRow(5).getCell(i + 2);
      const nodesAtLevel = tree[i];
      cell.value = (nodesAtLevel && nodesAtLevel.length > 0) ? nodesAtLevel[0].email : '—';
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: YELLOW_BG } };
      cell.font = { bold: false, size: 9, color: { argb: YELLOW_FONT }, name: 'Calibri' };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: false };
      applyBorder(cell, 'FFBF9000');
    }

    // Fill remaining cols in row 5 (cols 9-12)
    for (let c = 9; c <= 12; c++) {
      const cell = sheet.getRow(5).getCell(c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: YELLOW_BG } };
      applyBorder(cell, 'FFBF9000');
    }

    // ── ROW 6: Blank separator ────────────────────────────────────
    sheet.getRow(6).height = 6;

    // ── ROW 7: Section label ──────────────────────────────────────
    const sectionRow = sheet.getRow(7);
    sectionRow.height = 22;

    const sectionCell = sectionRow.getCell(1);
    sectionCell.value = 'Rebate (pips)';
    sectionCell.font = { bold: true, size: 11, color: { argb: WHITE }, name: 'Calibri' };
    sectionCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG2 } };
    sectionCell.alignment = { horizontal: 'left', vertical: 'middle' };
    applyBorder(sectionCell, 'FF1F3864');

    for (let c = 2; c <= 12; c++) {
      const cell = sectionRow.getCell(c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG2 } };
      applyBorder(cell, 'FF1F3864');
    }

    // ── ROWS 8+: ASSET DATA ───────────────────────────────────────
    const assetTypes = [
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

    let rowIdx = 8;
    for (const asset of assetTypes) {
      const row = sheet.getRow(rowIdx++);
      row.height = 18;

      let hasRebate = false;
      const pipValues: number[] = [];

      for (let i = 0; i <= 6; i++) {
        const nodesAtLevel = tree[i];
        let pips = 0;
        if (nodesAtLevel && nodesAtLevel.length > 0) {
          const configs = nodesAtLevel[0].rebateConfig;
          if (Array.isArray(configs)) {
            const match = configs.find((c: any) => c.assetType === asset.key);
            if (match) pips = Number(match.rebatePips ?? 0);
          }
        }
        if (pips > 0) hasRebate = true;
        pipValues.push(pips);
      }

      // Choose color theme based on whether any pips > 0
      const bgColor   = hasRebate ? GREEN_BG  : PINK_BG;
      const fontColor = hasRebate ? GREEN_FONT : PINK_FONT;
      const borderColor = hasRebate ? 'FFA9D18E' : 'FFF4B183';

      // Col 1: Asset label
      const labelCell2 = row.getCell(1);
      labelCell2.value = asset.label;
      labelCell2.font = { bold: false, size: 10, color: { argb: fontColor }, name: 'Calibri' };
      labelCell2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
      labelCell2.alignment = { horizontal: 'left', vertical: 'middle' };
      applyBorder(labelCell2, borderColor);

      // Cols 2-8: pips per level
      for (let i = 0; i <= 6; i++) {
        const cell = row.getCell(i + 2);
        const pips = pipValues[i];
        cell.value = pips;
        cell.font = {
          bold: pips > 0,
          size: 10,
          color: { argb: pips > 0 ? GREEN_FONT : 'FF999999' },
          name: 'Calibri',
        };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: pips > 0 ? GREEN_BG : GRAY_BG } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        applyBorder(cell, borderColor);
        cell.numFmt = '#,##0.##';
      }

      // Cols 9-11: empty spacer
      for (let c = 9; c <= 11; c++) {
        const cell = row.getCell(c);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRAY_BG } };
        applyBorder(cell, 'FFD9D9D9');
      }

      // Col 12: Max pips
      const maxPipsCell = row.getCell(12);
      maxPipsCell.value = asset.maxPips;
      maxPipsCell.font = { bold: true, size: 10, color: { argb: RED_FONT }, name: 'Calibri' };
      maxPipsCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2F2' } };
      maxPipsCell.alignment = { horizontal: 'center', vertical: 'middle' };
      maxPipsCell.numFmt = '#,##0.##';
      applyBorder(maxPipsCell, 'FFFF9999');
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer as any as Buffer;
  }

  async generateTransactionsExcel(
    rootIbId: string,
    targetIbId: string,
    period: string,
  ): Promise<Buffer> {
    // 1. Check subtree
    if (targetIbId && rootIbId !== targetIbId) {
      const rootLevel = (
        await this.prisma.ibNode.findUnique({ where: { id: rootIbId } })
      )?.level;
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

    let startDate, endDate;
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

    // ── COLORS ─────────────────────────────────────────────────
    const HDR_BG    = 'FF1F3864';
    const HDR_FONT  = 'FFFFFFFF';
    const ODD_BG    = 'FFF2F7FF';
    const EVEN_BG   = 'FFFFFFFF';

    // ── COLUMN DEFINITIONS ─────────────────────────────────────
    sheet.columns = [
      { key: 'date',         width: 22 },
      { key: 'name',         width: 20 },
      { key: 'email',        width: 28 },
      { key: 'assetType',    width: 16 },
      { key: 'rebateType',   width: 16 },
      { key: 'lots',         width: 12 },
      { key: 'rebateAmount', width: 16 },
      { key: 'currency',     width: 10 },
    ];

    const headers = ['Trade Date', 'IB Name', 'IB Email', 'Asset Type', 'Rebate Type', 'Lots', 'Rebate Amount', 'Currency'];

    // ── ROW 1: TITLE ──────────────────────────────────────────
    sheet.mergeCells('A1:H1');
    const title = sheet.getCell('A1');
    title.value = `TRANSACTION HISTORY${period ? ' — ' + period : ''}`;
    title.font = { bold: true, size: 13, color: { argb: HDR_FONT }, name: 'Calibri' };
    title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HDR_BG } };
    title.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 26;

    // ── ROW 2: Sub-info ──────────────────────────────────────
    sheet.mergeCells('A2:H2');
    const subCell = sheet.getCell('A2');
    subCell.value = `Generated: ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}   |   Total records: ${txs.length}`;
    subCell.font = { italic: true, size: 9, color: { argb: '80808080' }, name: 'Calibri' };
    subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
    subCell.alignment = { horizontal: 'right', vertical: 'middle' };
    sheet.getRow(2).height = 15;

    // ── ROW 3: Column headers ──────────────────────────────────
    const headerRow = sheet.getRow(3);
    headerRow.height = 22;
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.font = { bold: true, size: 10, color: { argb: HDR_FONT }, name: 'Calibri' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E75B6' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top:    { style: 'thin', color: { argb: 'FF1F3864' } },
        bottom: { style: 'medium', color: { argb: 'FF1F3864' } },
        left:   { style: 'thin', color: { argb: 'FF1F3864' } },
        right:  { style: 'thin', color: { argb: 'FF1F3864' } },
      };
    });

    // ── DATA ROWS ──────────────────────────────────────────────
    txs.forEach((tx, idx) => {
      const row = sheet.addRow({
        date:         tx.tradedAt.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
        name:         tx.ib.name || '—',
        email:        tx.ib.email,
        assetType:    tx.assetType,
        rebateType:   tx.rebateType,
        lots:         Number(tx.lots),
        rebateAmount: Number(tx.rebateAmount),
        currency:     tx.currency,
      });

      row.height = 17;
      const rowBg = idx % 2 === 0 ? ODD_BG : EVEN_BG;

      row.eachCell((cell, colNumber) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
        cell.font = { size: 10, name: 'Calibri' };
        cell.border = {
          top:    { style: 'thin', color: { argb: 'FFD9D9D9' } },
          bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
          left:   { style: 'thin', color: { argb: 'FFD9D9D9' } },
          right:  { style: 'thin', color: { argb: 'FFD9D9D9' } },
        };

        // Alignment per column
        if (colNumber === 1) cell.alignment = { horizontal: 'left' };
        else if (colNumber === 2 || colNumber === 3) cell.alignment = { horizontal: 'left' };
        else if (colNumber === 6 || colNumber === 7) {
          cell.alignment = { horizontal: 'right' };
          cell.numFmt = '#,##0.########';
        } else {
          cell.alignment = { horizontal: 'center' };
        }

        // Highlight rebate amount
        if (colNumber === 7) {
          const val = Number(tx.rebateAmount);
          if (val > 0) cell.font = { bold: true, size: 10, color: { argb: 'FF375623' }, name: 'Calibri' };
        }
      });
    });

    // ── TOTALS ROW ─────────────────────────────────────────────
    if (txs.length > 0) {
      const totalRow = sheet.addRow({
        date:         'TOTAL',
        lots:         txs.reduce((s, t) => s + Number(t.lots), 0),
        rebateAmount: txs.reduce((s, t) => s + Number(t.rebateAmount), 0),
        currency:     txs[0]?.currency || '',
      });
      totalRow.height = 20;
      totalRow.eachCell((cell, colNumber) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
        cell.font = { bold: true, size: 10, name: 'Calibri' };
        cell.border = {
          top:    { style: 'medium', color: { argb: 'FF2E75B6' } },
          bottom: { style: 'medium', color: { argb: 'FF2E75B6' } },
          left:   { style: 'thin', color: { argb: 'FFD9D9D9' } },
          right:  { style: 'thin', color: { argb: 'FFD9D9D9' } },
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
}
