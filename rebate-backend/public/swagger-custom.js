(function() {
  var LS_TOKEN = 'swagger_token';   // Written by landing page login
  var LS_EMAIL = 'swagger_email';   // Written by landing page login
  var LS_BAR_PASS = 'sw_pass';      // Written by topbar quick-login

  // ── Wait for Swagger UI to be ready ─────────────────────
  var checkLoaded = setInterval(function() {
    var topbar = document.querySelector('.topbar');
    if (topbar && window.ui) {
      clearInterval(checkLoaded);

      // Priority 1: token saved from landing page login
      var savedToken = localStorage.getItem(LS_TOKEN);
      var savedEmail = localStorage.getItem(LS_EMAIL) || '';

      if (savedToken) {
        window.ui.preauthorizeApiKey('Bearer', savedToken);
        // Token is one-time use on load, keep it so reload still works
        setupTopbarLoggedIn(topbar, savedEmail, savedToken);
      } else {
        // Fallback: show quick-login form
        setupTopbarLoginForm(topbar);
      }
    }
  }, 200);

  // ── Topbar: already logged in ────────────────────────────
  function setupTopbarLoggedIn(topbar, email, token) {
    var wrapper = document.createElement('div');
    wrapper.id = 'sw-topbar-widget';
    wrapper.style.cssText = 'display:flex;align-items:center;gap:10px;margin-left:20px;';

    var short = email ? (email.length > 24 ? email.slice(0, 21) + '…' : email) : 'user';
    wrapper.innerHTML =
      '<span style="font-size:12px;font-weight:700;color:#22c55e;white-space:nowrap;">✅ Logged in as ' + short + '</span>' +
      '<button id="sw-logout-btn" style="padding:4px 12px;border:1px solid #ef4444;border-radius:6px;background:transparent;color:#ef4444;font-size:11px;font-weight:700;cursor:pointer;transition:all 0.2s;" onmouseover="this.style.background=\'#fef2f2\'" onmouseout="this.style.background=\'transparent\'">Logout</button>';

    topbar.appendChild(wrapper);

    document.getElementById('sw-logout-btn').addEventListener('click', function() {
      localStorage.removeItem(LS_TOKEN);
      localStorage.removeItem(LS_EMAIL);
      localStorage.removeItem(LS_BAR_PASS);
      window.ui.preauthorizeApiKey('Bearer', '');
      wrapper.remove();
      setupTopbarLoginForm(topbar);
    });
  }

  // ── Topbar: quick-login form ─────────────────────────────
  function setupTopbarLoginForm(topbar) {
    var savedBarPass = localStorage.getItem(LS_BAR_PASS) || '';
    var savedEmail   = localStorage.getItem(LS_EMAIL) || '';

    var wrapper = document.createElement('div');
    wrapper.id = 'sw-topbar-widget';
    wrapper.style.cssText = 'display:flex;align-items:center;gap:8px;margin-left:20px;flex-wrap:wrap;';

    var inputStyle = 'padding:5px 10px;border:1px solid #3d4468;border-radius:6px;background:#1a1d2e;color:#e2e8f0;font-size:12px;outline:none;transition:border-color 0.2s;';

    wrapper.innerHTML =
      '<span style="font-size:12px;font-weight:700;color:#00c896;white-space:nowrap;letter-spacing:0.03em;">🔑 Quick Login:</span>' +
      '<input id="sw-email" type="email" placeholder="Email" value="' + savedEmail + '" style="' + inputStyle + 'width:170px;" onfocus="this.style.borderColor=\'#00c896\'" onblur="this.style.borderColor=\'#3d4468\'"/>' +
      '<input id="sw-password" type="password" placeholder="Mật khẩu" value="' + savedBarPass + '" style="' + inputStyle + 'width:110px;" onfocus="this.style.borderColor=\'#00c896\'" onblur="this.style.borderColor=\'#3d4468\'"/>' +
      '<button id="sw-btn" style="padding:5px 14px;border:none;border-radius:6px;background:linear-gradient(135deg,#00c896,#00a878);color:#fff;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;" onmouseover="this.style.opacity=\'0.85\'" onmouseout="this.style.opacity=\'1\'">Login</button>' +
      '<span id="sw-status" style="font-size:12px;font-weight:600;display:none;white-space:nowrap;"></span>';

    topbar.appendChild(wrapper);

    var btn           = document.getElementById('sw-btn');
    var emailInput    = document.getElementById('sw-email');
    var passwordInput = document.getElementById('sw-password');
    var statusSpan    = document.getElementById('sw-status');

    [emailInput, passwordInput].forEach(function(el) {
      el.addEventListener('keydown', function(e) { if (e.key === 'Enter') btn.click(); });
    });

    btn.addEventListener('click', async function() {
      var email    = emailInput.value.trim();
      var password = passwordInput.value;

      if (!email || !password) { showStatus('❌ Enter email and password', '#ef4444'); return; }

      btn.disabled = true;
      btn.textContent = 'Logging in...';
      statusSpan.style.display = 'none';

      try {
        var res = await fetch('/api/docs/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email, password: password })
        });
        var json = await res.json();

        if (json.success && json.data && json.data.accessToken) {
          var token = json.data.accessToken;
          window.ui.preauthorizeApiKey('Bearer', token);
          localStorage.setItem(LS_EMAIL, email);
          localStorage.setItem(LS_BAR_PASS, password);
          // Transition to logged-in state
          wrapper.remove();
          setupTopbarLoggedIn(topbar, email, token);
        } else {
          localStorage.removeItem(LS_BAR_PASS);
          var msg = (json.error && json.error.message) || 'Invalid credentials';
          showStatus('❌ ' + msg, '#ef4444');
        }
      } catch (err) {
        console.error('[Swagger Quick-Login]', err);
        showStatus('❌ Connection error', '#ef4444');
      } finally {
        if (btn.parentElement) { btn.disabled = false; btn.textContent = 'Login'; }
      }
    });

    function showStatus(text, color) {
      statusSpan.textContent = text;
      statusSpan.style.color = color;
      statusSpan.style.display = 'inline';
    }

    // Auto-login via bar credentials if available
    if (savedEmail && savedBarPass) {
      btn.click();
    }
  }
})();
