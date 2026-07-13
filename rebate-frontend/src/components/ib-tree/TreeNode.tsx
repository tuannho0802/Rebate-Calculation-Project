'use client';

import { useState } from 'react';
import { IbTreeNode } from '@/types';
import { ChevronRight, ChevronDown, User, Users } from 'lucide-react';

interface TreeNodeProps {
  node: IbTreeNode;
  isLast?: boolean;
  onNodeClick?: (id: string) => void;
}

export function TreeNode({ node, isLast = true, onNodeClick }: TreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;

  const roleText = node.level === 0 ? 'MIB' : `Lv${node.level}`;

  return (
    <div className="relative">
      {/* Node Content */}
      <div className="flex items-center gap-2 py-2 relative z-10 group">
        {hasChildren ? (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded hover:bg-blue-50 text-gray-500 hover:text-blue-600 transition-colors z-20 bg-white shadow-sm border border-gray-100"
          >
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        ) : (
          <div className="w-6" /> // Spacing for leaf nodes
        )}

        <div 
          onClick={() => onNodeClick && onNodeClick(node.id)}
          className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg p-2.5 shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer flex-1 md:flex-none min-w-[280px]"
        >
          <div className="w-9 h-9 rounded-md bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center text-blue-600 border border-blue-200">
            {node.level === 0 ? <Users className="h-5 w-5" /> : <User className="h-4 w-4" />}
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-gray-800">{node.email}</span>
            <span className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${node.level === 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-blue-100 text-blue-700'}`}>
                {roleText}
              </span>
              <span>•</span>
              <span className="font-medium">{node.totalChildren} F1</span>
            </span>
          </div>
        </div>
      </div>

      {/* Children Hierarchy with precise Tailwind CSS tree lines */}
      {isExpanded && hasChildren && (
        <div className="relative ml-3 border-l-2 border-gray-200/80 pl-6 pb-2 mt-[-4px]">
          {node.children!.filter(c => c.isActive !== false).map((child, index, filteredChildren) => {
            const isChildLast = index === filteredChildren.length - 1;
            return (
              <div key={child.id} className="relative">
                {/* Horizontal branch line pointing to child */}
                <div className="absolute top-6 -left-6 w-6 border-b-2 border-gray-200/80" />
                {/* Hide the bottom part of vertical line for the last child to make it look clean */}
                {isChildLast && (
                  <div className="absolute top-6 -left-[2px] bottom-0 w-1 bg-white z-0" />
                )}
                <TreeNode node={child} isLast={isChildLast} onNodeClick={onNodeClick} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
