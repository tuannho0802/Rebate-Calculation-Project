'use client';

/**
 * PivotArrowOverlay — SVG overlay vẽ đường thẳng nối input cha-con trong PivotTable.
 *
 * THIẾT KẾ KHÔNG TRỄ KHI SCROLL:
 *   - SVG có kích thước = scrollWidth × scrollHeight của container (toàn bộ nội dung).
 *   - Tọa độ tính theo hệ tọa độ NỘI DUNG (cộng scrollLeft/scrollTop) — cố định, không
 *     phụ thuộc scroll offset tại thời điểm tính.
 *   - SVG cuộn cùng bảng như 1 DOM element bình thường → không cần JS can thiệp scroll.
 *   - KHÔNG có scroll listener → không có độ trễ 1 frame khi cuộn.
 *   - GIỮ ResizeObserver: tính lại khi resize cửa sổ hoặc bảng đổi kích thước.
 *   - data-arrow-id gắn trên <input> (không phải div bọc ngoài) → điểm neo đúng giữa input.
 */

import { useEffect, useRef, useState, useCallback } from 'react';

interface Arrow {
  key: string;
  parentId: string;
  childId: string;
  assetType: string;
  // Tọa độ trong hệ tọa độ NỘI DUNG ĐẦY ĐỦ (không đổi khi scroll)
  x1: number; y1: number;
  x2: number; y2: number;
}

interface PivotArrowOverlayProps {
  enabled: boolean;
  parentChildPairs: Array<{ parentId: string; childId: string }>;
  assetTypes: string[];
  containerRef: React.RefObject<HTMLDivElement | null>;
  hoveredArrowKey: string | null;
}

export function PivotArrowOverlay({
  enabled,
  parentChildPairs,
  assetTypes,
  containerRef,
  hoveredArrowKey,
}: PivotArrowOverlayProps) {
  const [arrows, setArrows]   = useState<Arrow[]>([]);
  // Kích thước toàn bộ nội dung có thể cuộn — để SVG trải rộng đủ
  const [svgSize, setSvgSize] = useState({ w: 0, h: 0 });
  const rafRef = useRef<number | null>(null);

  const recompute = useCallback(() => {
    if (!enabled || !containerRef.current) {
      setArrows([]);
      return;
    }

    const container = containerRef.current;
    const contRect  = container.getBoundingClientRect();

    // Cập nhật kích thước SVG = toàn bộ nội dung scrollable
    setSvgSize({ w: container.scrollWidth, h: container.scrollHeight });

    const computed: Arrow[] = [];

    for (const assetType of assetTypes) {
      for (const { parentId, childId } of parentChildPairs) {
        // data-arrow-id gắn trên <input> → querySelector trả về chính input element
        const parentInput = container.querySelector<HTMLElement>(
          `[data-arrow-id="${parentId}__${assetType}"]`,
        );
        const childInput = container.querySelector<HTMLElement>(
          `[data-arrow-id="${childId}__${assetType}"]`,
        );
        if (!parentInput || !childInput) continue;

        const pr = parentInput.getBoundingClientRect();
        const cr = childInput.getBoundingClientRect();

        // Chuyển từ tọa độ viewport → tọa độ nội dung (cộng scroll offset)
        // Công thức: cellRect.left - contRect.left + container.scrollLeft
        // → "hoàn tác" scroll hiện tại, ra tọa độ cố định trong hệ nội dung
        const x1 = pr.right  - contRect.left + container.scrollLeft;
        const y1 = pr.top    - contRect.top  + container.scrollTop + pr.height / 2;
        const x2 = cr.left   - contRect.left + container.scrollLeft;
        const y2 = cr.top    - contRect.top  + container.scrollTop + cr.height / 2;

        computed.push({
          key: `${parentId}--${childId}--${assetType}`,
          parentId, childId, assetType,
          x1, y1, x2, y2,
        });
      }
    }

    setArrows(computed);
  }, [enabled, parentChildPairs, assetTypes, containerRef]);

  const scheduleRecompute = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      recompute();
      rafRef.current = null;
    });
  }, [recompute]);

  useEffect(() => {
    if (!enabled) {
      setArrows([]);
      setSvgSize({ w: 0, h: 0 });
      return;
    }

    scheduleRecompute();

    const container = containerRef.current;
    if (!container) return;

    // ResizeObserver: tính lại khi bảng hoặc cửa sổ thay đổi kích thước
    const ro = new ResizeObserver(scheduleRecompute);
    ro.observe(container);
    window.addEventListener('resize', scheduleRecompute, { passive: true });

    // KHÔNG có scroll listener — SVG cuộn cùng nội dung, không cần recompute khi scroll

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', scheduleRecompute);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [enabled, scheduleRecompute, containerRef]);

  if (!enabled) return null;

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        // Trải rộng đủ toàn bộ nội dung — cuộn cùng bảng, không cố định viewport
        width:  svgSize.w || '100%',
        height: svgSize.h || '100%',
        pointerEvents: 'none',
        zIndex: 5,
        overflow: 'visible',
      }}
      aria-hidden="true"
    >
      <defs>
        <marker id="pivot-arrow-dim" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <polygon points="0 0, 6 3, 0 6" fill="#6366f1" fillOpacity={0.35} />
        </marker>
        <marker id="pivot-arrow-bright" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <polygon points="0 0, 6 3, 0 6" fill="#6366f1" />
        </marker>
      </defs>

      {arrows.map(({ key, parentId, childId, assetType, x1, y1, x2, y2 }) => {
        // Highlight chỉ đường trong đúng hàng asset đang hover (không lan hàng khác)
        const isHighlighted =
          hoveredArrowKey !== null && (
            hoveredArrowKey === `${parentId}__${assetType}` ||
            hoveredArrowKey === `${childId}__${assetType}`
          );

        return (
          <path
            key={key}
            d={`M ${x1},${y1} L ${x2},${y2}`}
            fill="none"
            stroke="#6366f1"
            strokeWidth={isHighlighted ? 2.5 : 1.5}
            strokeOpacity={isHighlighted ? 1 : 0.2}
            markerEnd={isHighlighted ? 'url(#pivot-arrow-bright)' : 'url(#pivot-arrow-dim)'}
            style={{ transition: 'stroke-opacity 0.15s, stroke-width 0.15s' }}
          />
        );
      })}
    </svg>
  );
}
