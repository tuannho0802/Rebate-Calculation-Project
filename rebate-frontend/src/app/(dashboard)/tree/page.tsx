'use client';

import React, { useEffect, useState } from 'react';
import { ibApi } from '@/lib/api/ib';
import { rebateApi } from '@/lib/api/rebate';
import { useAuthStore } from '@/store/auth.store';
import { IbTreeNode, RebateConfig, AssetType, MAX_PIPS } from '@/types';
import { getErrorMessage } from '@/lib/error-messages';

export default function TreePage() {
  const { user } = useAuthStore();
  const [treeData, setTreeData] = useState<IbTreeNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<IbTreeNode | null>(null);
  const [selectedConfig, setSelectedConfig] = useState<RebateConfig | null>(null);
  const [isLoadingTree, setIsLoadingTree] = useState(true);

  // New sub-IB Form states
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Config Update States
  const [editableConfig, setEditableConfig] = useState<any[]>([]);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const loadTree = async () => {
    setIsLoadingTree(true);
    try {
      const data = await ibApi.getTree('all');
      setTreeData(data);
      if (!selectedNode) {
        setSelectedNode(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingTree(false);
    }
  };

  useEffect(() => {
    loadTree();
  }, []);

  useEffect(() => {
    if (selectedNode) {
      const loadNodeConfig = async () => {
        try {
          const config = await rebateApi.getConfig(selectedNode.id);
          setSelectedConfig(config);
          setEditableConfig(
            config.assets.map((a) => ({
              ...a,
              rebatePips: Number(a.rebatePips),
              markupPips: Number(a.markupPips),
            }))
          );
          setUpdateError(null);
          setUpdateSuccess(false);
        } catch (e) {
          console.error(e);
        }
      };
      loadNodeConfig();
    }
  }, [selectedNode]);

  const handleCreateIb = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreateSuccess(false);
    setIsCreating(true);

    try {
      await ibApi.create(newEmail, newPassword);
      setCreateSuccess(true);
      setNewEmail('');
      setNewPassword('');
      loadTree(); // Refresh tree
    } catch (err: any) {
      const code = err.response?.data?.error?.code || 'INTERNAL_ERROR';
      setCreateError(getErrorMessage(code));
    } finally {
      setIsCreating(false);
    }
  };

  const handleConfigChange = (index: number, field: string, value: number) => {
    setEditableConfig((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleUpdateConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNode) return;
    setUpdateError(null);
    setUpdateSuccess(false);
    setIsUpdating(true);

    try {
      // Send configurations
      const data = await rebateApi.updateConfig(selectedNode.id, editableConfig);
      setSelectedConfig(data);
      setUpdateSuccess(true);
    } catch (err: any) {
      const code = err.response?.data?.error?.code || 'INTERNAL_ERROR';
      setUpdateError(getErrorMessage(code));
    } finally {
      setIsUpdating(false);
    }
  };

  // Recursive Tree Node Renderer
  const renderTree = (node: IbTreeNode, depth = 0) => {
    const isSelected = selectedNode?.id === node.id;
    return (
      <div key={node.id} className="space-y-1">
        <button
          onClick={() => setSelectedNode(node)}
          style={{ paddingLeft: `${depth * 1.5 + 1}rem` }}
          className={`w-full flex items-center justify-between py-2 px-3 rounded-lg text-sm text-left transition ${
            isSelected
              ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 font-semibold'
              : 'text-slate-300 hover:bg-slate-800/60'
          }`}
        >
          <div className="flex items-center gap-2 truncate">
            <span className="text-slate-500">└</span>
            <span className="truncate">{node.email}</span>
          </div>
          <span className="text-xs shrink-0 text-slate-500 bg-slate-950/80 px-2 py-0.5 rounded border border-slate-800">
            Lv{node.level}
          </span>
        </button>
        {node.children && node.children.length > 0 && (
          <div className="space-y-1">
            {node.children.map((child) => renderTree(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Quản lý Cây IB</h1>
        <p className="text-slate-400 mt-1">Xem sơ đồ cấp bậc, thêm thành viên mới, và điều chỉnh tỉ lệ hoa hồng.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Tree Visualizer + Create sub-IB */}
        <div className="space-y-8 lg:col-span-1">
          {/* Tree view */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-lg font-bold text-white mb-4">Sơ đồ tổ chức</h2>
            {isLoadingTree ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : treeData ? (
              <div className="space-y-1">{renderTree(treeData)}</div>
            ) : (
              <div className="text-sm text-slate-500 py-4 text-center">Không có sơ đồ.</div>
            )}
          </div>

          {/* Add subordinate IB */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-lg font-bold text-white mb-4">Tạo IB cấp dưới trực tiếp</h2>
            <form onSubmit={handleCreateIb} className="space-y-4">
              {createError && (
                <div className="rounded-lg bg-red-900/35 border border-red-800/40 p-3 text-xs text-red-200">
                  {createError}
                </div>
              )}
              {createSuccess && (
                <div className="rounded-lg bg-emerald-900/35 border border-emerald-800/40 p-3 text-xs text-emerald-200">
                  Tạo tài khoản IB mới thành công!
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Email đăng ký
                </label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none text-sm"
                  placeholder="name@example.com"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Mật khẩu ban đầu
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none text-sm"
                  placeholder="••••••••"
                />
              </div>
              <button
                type="submit"
                disabled={isCreating}
                className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 focus:outline-none disabled:opacity-55 transition"
              >
                {isCreating ? 'Đang tạo...' : 'Tạo tài khoản'}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Configurations update */}
        <div className="lg:col-span-2">
          {selectedNode ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-800 pb-4 mb-6 gap-2">
                <div>
                  <h2 className="text-lg font-bold text-white">Cấu hình Rebate</h2>
                  <p className="text-xs text-slate-400 truncate mt-1">IB: {selectedNode.email}</p>
                </div>
                <div className="text-xs bg-slate-950 px-3 py-1 rounded-full border border-slate-800 text-slate-300 font-medium shrink-0">
                  Level {selectedNode.level}
                </div>
              </div>

              <form onSubmit={handleUpdateConfig} className="space-y-6">
                {updateError && (
                  <div className="rounded-lg bg-red-900/35 border border-red-800/40 p-3 text-xs text-red-200">
                    {updateError}
                  </div>
                )}
                {updateSuccess && (
                  <div className="rounded-lg bg-emerald-900/35 border border-emerald-800/40 p-3 text-xs text-emerald-200">
                    Cập nhật cấu hình hoa hồng thành công!
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left text-slate-300">
                    <thead className="text-xs uppercase bg-slate-950 text-slate-500 border-b border-slate-800">
                      <tr>
                        <th className="px-4 py-3">Sản phẩm</th>
                        <th className="px-4 py-3 text-center">Giới hạn Max Pips</th>
                        <th className="px-4 py-3">Giữ lại (Rebate Pips)</th>
                        <th className="px-4 py-3">Chuyển tiếp (Markup Pips)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {editableConfig.filter(a => a.assetType === AssetType.FOREX || a.assetType === AssetType.GOLD).map((asset, idx) => {
                        const maxLimit = asset.maxPips;
                        const isSelf = selectedNode.id === user?.id;
                        return (
                          <tr key={asset.assetType} className="hover:bg-slate-800/40">
                            <td className="px-4 py-4 font-semibold text-white">{asset.assetType}</td>
                            <td className="px-4 py-4 text-center text-slate-500 font-medium">
                              {maxLimit} pips
                            </td>
                            <td className="px-4 py-4">
                              {isSelf ? (
                                <span className="font-semibold text-emerald-400">{asset.rebatePips} pips</span>
                              ) : (
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max={maxLimit}
                                  value={asset.rebatePips}
                                  onChange={(e) =>
                                    handleConfigChange(idx, 'rebatePips', parseFloat(e.target.value) || 0)
                                  }
                                  className="w-24 rounded border border-slate-800 bg-slate-950 px-2 py-1 text-white focus:border-emerald-500 focus:outline-none text-xs text-right"
                                />
                              )}
                            </td>
                            <td className="px-4 py-4">
                              {isSelf ? (
                                <span className="text-slate-400">{asset.markupPips} pips</span>
                              ) : (
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max={maxLimit}
                                  value={asset.markupPips}
                                  onChange={(e) =>
                                    handleConfigChange(idx, 'markupPips', parseFloat(e.target.value) || 0)
                                  }
                                  className="w-24 rounded border border-slate-800 bg-slate-950 px-2 py-1 text-white focus:border-emerald-500 focus:outline-none text-xs text-right"
                                />
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {selectedNode.id !== user?.id ? (
                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 focus:outline-none disabled:opacity-55 transition"
                  >
                    {isUpdating ? 'Đang cập nhật...' : 'Cập nhật cấu hình'}
                  </button>
                ) : (
                  <p className="text-xs text-slate-500 italic text-center">
                    Bạn chỉ có thể cập nhật cấu hình cho cấp dưới.
                  </p>
                )}
              </form>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center text-slate-500">
              Chọn một IB bên sơ đồ tổ chức để thiết lập tỉ lệ hoa hồng.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
