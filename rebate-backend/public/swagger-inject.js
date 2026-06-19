(function () {
  function injectUI() {
    var desc = document.querySelector('.swagger-ui .info .description');
    if (!desc || desc.dataset.injected) return;
    desc.dataset.injected = 'true';

    var isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var bg = isDark ? '#0f172a' : '#f8fafc';
    var border = isDark ? '#1e293b' : '#e2e8f0';
    var textMuted = isDark ? '#94a3b8' : '#64748b';
    var textBody = isDark ? '#cbd5e1' : '#374151';
    var codeBg = isDark ? '#1e293b' : '#f1f5f9';
    var codeColor = isDark ? '#34d399' : '#0f766e';

    var isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    var quickStartBlock = isLocal ? [
      '<div style="background:' + bg + ';border:1px solid ' + border + ';border-radius:10px;padding:20px 24px;margin-bottom:14px;">',
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">',
      '<span style="background:#00c896;color:#000;font-size:11px;font-weight:700;padding:2px 9px;border-radius:4px;letter-spacing:.05em;">QUICK START</span>',
      '<span style="color:' + textMuted + ';font-size:13px;">3 bước để bắt đầu test</span>',
      '</div>',
      '<div style="font-size:13px;color:' + textBody + ';line-height:1.9;">',
      '<div style="display:flex;gap:10px;margin-bottom:10px;">',
      '<span style="background:#1e40af;color:#fff;min-width:20px;height:20px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;margin-top:2px;">1</span>',
      '<span>Mở <code style="background:' + codeBg + ';color:' + codeColor + ';padding:1px 6px;border-radius:3px;font-size:12px;">POST /api/auth/login</code> → <b>Try it out</b> → body: <code style="background:' + codeBg + ';color:' + codeColor + ';padding:1px 6px;border-radius:3px;font-size:12px;">{"email":"mib@test.com","password":"Test@1234"}</code> → Execute</span>',
      '</div>',
      '<div style="display:flex;gap:10px;margin-bottom:10px;">',
      '<span style="background:#1e40af;color:#fff;min-width:20px;height:20px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;margin-top:2px;">2</span>',
      '<span>Copy <code style="background:' + codeBg + ';color:' + codeColor + ';padding:1px 6px;border-radius:3px;font-size:12px;">accessToken</code> từ response → Click <b>Authorize 🔒</b> góc trên phải → Paste → Authorize</span>',
      '</div>',
      '<div style="display:flex;gap:10px;">',
      '<span style="background:#1e40af;color:#fff;min-width:20px;height:20px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;margin-top:2px;">3</span>',
      '<span>Test bất kỳ endpoint nào — token tự động gắn vào tất cả request</span>',
      '</div>',
      '</div>',
      '</div>',
    ].join('') : '';

    desc.innerHTML = [
      '<div style="font-family:Inter,system-ui,sans-serif;max-width:820px;margin-top:4px;">',
      quickStartBlock,

      // ── TEST ACCOUNTS ──
      '<div style="background:' + bg + ';border:1px solid ' + border + ';border-radius:10px;padding:20px 24px;margin-bottom:14px;">',
      '<div style="color:' + textMuted + ';font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-bottom:14px;">Tài khoản test sẵn có</div>',
      '<table style="width:100%;border-collapse:collapse;font-size:13px;">',
      '<thead><tr style="border-bottom:1px solid ' + border + ';">',
      '<th style="color:' + textMuted + ';font-weight:600;padding:4px 12px 10px 0;text-align:left;width:120px;">Role</th>',
      '<th style="color:' + textMuted + ';font-weight:600;padding:4px 12px 10px;text-align:left;">Email</th>',
      '<th style="color:' + textMuted + ';font-weight:600;padding:4px 0 10px;text-align:left;">Password</th>',
      '</tr></thead>',
      '<tbody>',
      '<tr><td style="padding:7px 12px 7px 0;"><span style="background:#7c3aed;color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;">MIB Lv0</span></td><td style="padding:7px 12px;color:#00c896;font-family:monospace;">mib@test.com</td><td style="padding:7px 0;color:' + textMuted + ';font-family:monospace;">Test@1234</td></tr>',
      '<tr><td style="padding:7px 12px 7px 0;"><span style="background:#0284c7;color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;">IB Lv1-A</span></td><td style="padding:7px 12px;color:#00c896;font-family:monospace;">lv1-a@test.com</td><td style="padding:7px 0;color:' + textMuted + ';font-family:monospace;">Test@1234</td></tr>',
      '<tr><td style="padding:7px 12px 7px 0;"><span style="background:#0284c7;color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;">IB Lv1-B</span></td><td style="padding:7px 12px;color:#00c896;font-family:monospace;">lv1-b@test.com</td><td style="padding:7px 0;color:' + textMuted + ';font-family:monospace;">Test@1234</td></tr>',
      '<tr><td style="padding:7px 12px 7px 0;"><span style="background:#0f766e;color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;">IB Lv2</span></td><td style="padding:7px 12px;color:#00c896;font-family:monospace;">lv2-a@test.com</td><td style="padding:7px 0;color:' + textMuted + ';font-family:monospace;">Test@1234</td></tr>',
      '<tr><td style="padding:7px 12px 7px 0;"><span style="background:#92400e;color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;">IB Lv3</span></td><td style="padding:7px 12px;color:#00c896;font-family:monospace;">lv3-a@test.com</td><td style="padding:7px 0;color:' + textMuted + ';font-family:monospace;">Test@1234</td></tr>',
      '</tbody>',
      '</table>',
      '</div>',

      // ── ERROR CODES ──
      '<div style="background:' + bg + ';border:1px solid ' + border + ';border-radius:10px;padding:20px 24px;">',
      '<div style="color:' + textMuted + ';font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-bottom:14px;">Mã lỗi thường gặp</div>',
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">',
      '<div style="display:flex;align-items:center;gap:8px;"><code style="background:#1e293b;color:#f87171;padding:3px 10px;border-radius:4px;font-size:12px;min-width:36px;text-align:center;">401</code><span style="color:' + textBody + ';font-size:13px;">Token không hợp lệ / hết hạn</span></div>',
      '<div style="display:flex;align-items:center;gap:8px;"><code style="background:#1e293b;color:#fb923c;padding:3px 10px;border-radius:4px;font-size:12px;min-width:36px;text-align:center;">403</code><span style="color:' + textBody + ';font-size:13px;">Không có quyền trên IB này</span></div>',
      '<div style="display:flex;align-items:center;gap:8px;"><code style="background:#1e293b;color:#a78bfa;padding:3px 10px;border-radius:4px;font-size:12px;min-width:36px;text-align:center;">404</code><span style="color:' + textBody + ';font-size:13px;">Không tìm thấy IB với ID đã cho</span></div>',
      '<div style="display:flex;align-items:center;gap:8px;"><code style="background:#1e293b;color:#f9a8d4;padding:3px 10px;border-radius:4px;font-size:12px;min-width:36px;text-align:center;">422</code><span style="color:' + textBody + ';font-size:13px;">Lỗi logic (email trùng, vượt pips...)</span></div>',
      '</div>',
      '</div>',

      '</div>'
    ].join('');
  }

  // Thử inject ngay, rồi retry sau 500ms và 1500ms đề phòng React chưa render xong
  document.addEventListener('DOMContentLoaded', function () {
    setTimeout(injectUI, 500);
    setTimeout(injectUI, 1500);
  });
  window.addEventListener('load', function () {
    setTimeout(injectUI, 300);
  });
})();
