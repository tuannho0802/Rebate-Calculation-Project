'use client';

/**
 * PivotArrowOverlay — SVG overlay vẽ đường bezier nối ô cha-con trong PivotTable.
 *
 * Cách hoạt động:
 *   - Nhận data-arrow-id attribute từ các input cell trong PivotTable.
 *   - Khi toggle BẬT: đọc getBoundingClientRect() của từng cặp cha-con,
 *     vẽ cubic bezier nối cạnh phải ô cha → cạnh trái ô con.
 *   - Khi toggle TẮT: return null — không tính toán gì cả.
 *   - Vẽ lại qua ResizeObserver + scroll listener trên containerRef.
 *   - Hover: đường nối liên quan tới node đang hover tăng opacity + stroke-width.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { IbTreeNode } from '@/types';

interface Arrow {
  parentId: string;
  childId: string;
  // Coordinates relative to container
  x1: number; y1: number; // exit point cha (right-center)
  x2: number; y2: number; // entry point con (left-center)
}

interface PivotArrowOverlayProps {
  /** Có đang hiển thị overlay không */
  enabled: boolean;
  /** Danh sách cặp cha-con cần vẽ (parentId, childId) */
  parentChildPairs: Array<{ parentId: string; childId: string }>;
  /** containerRef của div bọc ngoài PivotTable */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** ibId đang hover (từ PivotTable truyền xuống) */
  hoveredIbId: string | null;
}

export function PivotArrowOverlay({
  enabled,
  parentChildPairs,
  containerRef,
  hoveredIbId,
}: PivotArrowOverlayProps) {
  const [arrows, setArrows] = useState<Arrow[]>([]);
  const rafRef = useRef<number | null>(null);

  const recompute = useCallback(() => {
    if (!enabled || !containerRef.current) {
      setArrows([]);
      return;
    }
    const containerRect = containerRef.current.getBoundingClientRect();

    const computed: Arrow[] = [];

    for (const { parentId, childId } of parentChildPairs) {
      // Tìm DOM element cho cha và con — dùng data-arrow-id attribute
      const parentEl = containerRef.current.querySelector<HTMLElement>(
        `[data-arrow-id="${parentId}"]`,
      );
      const childEl = containerRef.current.querySelector<HTMLElement>(
        `[data-arrow-id="${childId}"]`,
      );
      if (!parentEl || !childEl) continue;

      const pr = parentEl.getBoundingClientRect();
      const cr = childEl.getBoundingClientRect();

      // Exit point: right-center của cha
      const x1 = pr.right - containerRect.left;
      const y1 = pr.top + pr.height / 2 - containerRect.top;
      // Entry point: left-center của con
      const x2 = cr.left - containerRect.left;
      const y2 = cr.top + cr.height / 2 - containerRect.top;

      // Chỉ vẽ nếu cả 2 ô đang visible trong viewport (không bị scroll ra ngoài)
      if (
        pr.bottom < containerRect.top || pr.top > containerRect.bottom ||
        cr.bottom < containerRect.top || cr.top > containerRect.bottom
      ) continue;

      computed.push({ parentId, childId, x1, y1, x2, y2 });
    }

    setArrows(computed);
  }, [enabled, parentChildPairs, containerRef]);

  // Schedule recompute via rAF to batch with layout
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
      return;
    }

    // Initial compute
    scheduleRecompute();

    const container = containerRef.current;
    if (!container) return;

    // ResizeObserver: vẽ lại khi container thay đổi kích thước
    const ro = new ResizeObserver(scheduleRecompute);
    ro.observe(container);

    // Scroll listener: vẽ lại khi scroll trong container hoặc window
    container.addEventListener('scroll', scheduleRecompute, { passive: true });
    window.addEventListener('scroll', scheduleRecompute, { passive: true });
    window.addEventListener('resize', scheduleRecompute, { passive: true });

    return () => {
      ro.disconnect();
      container.removeEventListener('scroll', scheduleRecompute);
      window.removeEventListener('scroll', scheduleRecompute);
      window.removeEventListener('resize', scheduleRecompute);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [enabled, scheduleRecompute, containerRef]);

  // Khi toggle TẮT → không render gì
  if (!enabled) return null;

  return (
    <svg
      className="absolute inset-0 pointer-events-none overflow-visible"
      style={{ zIndex: 5 }}
      aria-hidden="true"
    >
      <defs>
        {/* Arrow marker — filled indigo */}
        <marker
          id="arrow-default"
          markerWidth="6"
          markerHeight="6"
          refX="5"
          refY="3"
          orient="auto"
        >
          <polygon points="0 0, 6 3, 0 6" fill="#6366f1" fillOpacity={0.3} />
        </marker>
        <marker
          id="arrow-hover"
          markerWidth="6"
          markerHeight="6"
          refX="5"
          refY="3"
          orient="auto"
        >
          <polygon points="0 0, 6 3, 0 6" fill="#6366f1" />
        </marker>
      </defs>

      {arrows.map(({ parentId, childId, x1, y1, x2, y2 }) => {
        const isHighlighted =
          hoveredIbId !== null &&
          (hoveredIbId === parentId || hoveredIbId === childId);

        // Cubic bezier control points: horizontal tension proportional to distance
        const dx = Math.abs(x2 - x1);
        const tension = Math.max(40, dx * 0.4);
        const cx1 = x1 + tension;
        const cx2 = x2 - tension;

        return (
          <path
            key={`${parentId}--${childId}`}
            d={`M ${x1},${y1} C ${cx1},${y1} ${cx2},${y2} ${x2},${y2}`}
            fill="none"
            stroke="#6366f1"
            strokeWidth={isHighlighted ? 2.5 : 1.5}
            strokeOpacity={isHighlighted ? 1 : 0.2}
            markerEnd={isHighlighted ? 'url(#arrow-hover)' : 'url(#arrow-default)'}
            style={{ transition: 'stroke-opacity 0.15s, stroke-width 0.15s' }}
          />
        );
      })}
    </svg>
  );
}
