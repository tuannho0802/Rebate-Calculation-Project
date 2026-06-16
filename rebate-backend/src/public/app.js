// ===== NAVBAR SCROLL EFFECT =====
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  if (window.scrollY > 20) {
    navbar.style.boxShadow = '0 4px 20px rgba(0,0,0,0.08)';
    navbar.style.backdropFilter = 'blur(10px)';
    navbar.style.backgroundColor = 'rgba(255,255,255,0.95)';
  } else {
    navbar.style.boxShadow = 'none';
    navbar.style.backdropFilter = 'none';
    navbar.style.backgroundColor = '#ffffff';
  }
}, { passive: true });

// ===== SMOOTH SCROLL =====
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    const href = this.getAttribute('href');
    if (href === '#') return;
    e.preventDefault();
    const target = document.querySelector(href);
    if (target) {
      const navH = navbar ? navbar.offsetHeight : 64;
      const top = target.getBoundingClientRect().top + window.scrollY - navH - 16;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  });
});

// ===== HERO NAV PADDING =====
function fixHeroPadding() {
  const hero = document.getElementById('hero');
  if (hero && navbar) {
    hero.style.paddingTop = (navbar.offsetHeight + 40) + 'px';
  }
}
fixHeroPadding();
window.addEventListener('resize', fixHeroPadding);

// ===== SCROLL ANIMATIONS =====
const animatedEls = Array.from(document.querySelectorAll('.animate-on-scroll'));

// Set hidden state
animatedEls.forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(28px)';
  el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
});

function checkVisibility() {
  animatedEls.forEach((el, i) => {
    if (el.style.opacity === '1') return; // already visible, skip
    const rect = el.getBoundingClientRect();
    const inView = rect.top < window.innerHeight - 48;
    if (inView) {
      const delay = (i % 3) * 100;
      setTimeout(() => {
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
      }, delay);
    }
  });
}

window.addEventListener('scroll', checkVisibility, { passive: true });
setTimeout(checkVisibility, 300);

// ===== STATS COUNTER =====
function animateCounter(el, target, suffix, duration) {
  if (!el) return;
  duration = duration || 1200;
  const start = performance.now();
  function update(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = target * eased;
    const display = Number.isInteger(target)
      ? Math.floor(value)
      : value.toFixed(1);
    el.textContent = display + suffix;
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

setTimeout(function() {
  animateCounter(document.getElementById('stat-endpoints'), 10, '+');
  animateCounter(document.getElementById('stat-uptime'), 99.9, '%');
}, 600);

// ===== TERMINAL TYPING =====
(function() {
  const cmdEl = document.getElementById('terminal-cmd');
  const cursor = document.getElementById('terminal-cursor');
  const response = document.getElementById('terminal-response');
  if (!cmdEl || !cursor || !response) return;

  const text = "curl -X POST /api/auth/login \\\n  -d '{\"email\":\"lv1-a@test.com\"}'";
  let i = 0;

  function type() {
    if (i < text.length) {
      cmdEl.textContent += text[i];
      i++;
      setTimeout(type, 35);
    } else {
      cursor.style.display = 'none';
      setTimeout(function() {
        response.style.display = 'block';
        response.style.opacity = '0';
        response.style.transition = 'opacity 0.5s ease';
        setTimeout(function() { response.style.opacity = '1'; }, 50);
      }, 400);
    }
  }

  setTimeout(type, 800);
})();

// ===== PASSWORD TOGGLE =====
(function() {
  const toggleBtn = document.getElementById('toggle-password');
  const passwordInput = document.getElementById('login-password');
  const eyeOpen = document.getElementById('eye-open');
  const eyeClosed = document.getElementById('eye-closed');
  if (!toggleBtn || !passwordInput) return;

  toggleBtn.addEventListener('click', function() {
    const isPassword = passwordInput.type === 'password';
    passwordInput.type = isPassword ? 'text' : 'password';
    eyeOpen.style.display = isPassword ? 'none' : 'block';
    eyeClosed.style.display = isPassword ? 'block' : 'none';
  });
})();

// ===== LOGIN FORM =====
(function() {
  const loginBtn = document.getElementById('login-btn');
  const emailInput = document.getElementById('login-email');
  const passwordInput = document.getElementById('login-password');
  const errorBox = document.getElementById('login-error');
  const errorMsg = document.getElementById('error-msg');
  if (!loginBtn) return;

  function showError(msg) {
    errorMsg.textContent = '❌ ' + msg;
    errorBox.style.display = 'block';
    loginBtn.disabled = false;
    loginBtn.innerHTML = 'Đăng nhập →';
  }

  async function handleLogin() {
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    errorBox.style.display = 'none';

    if (!email || !password) {
      showError('Vui lòng nhập email và mật khẩu');
      return;
    }

    loginBtn.disabled = true;
    loginBtn.innerHTML = '<span class="spinner"></span> Đang đăng nhập...';

    try {
      const res = await fetch('/api/docs/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const json = await res.json();

      if (!res.ok) {
        showError(json.error?.message || 'Email hoặc mật khẩu không đúng');
        return;
      }

      const token = (json.data && json.data.accessToken) || json.accessToken;
      if (!token) {
        showError('Không nhận được token từ server');
        return;
      }

      localStorage.setItem('swagger_token', token);
      localStorage.setItem('swagger_email', email);

      loginBtn.innerHTML = '✅ Đăng nhập thành công! Đang chuyển hướng...';
      loginBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';

      setTimeout(function() {
        window.location.href = '/api/docs';
      }, 800);

    } catch(err) {
      showError('Lỗi kết nối server. Vui lòng thử lại.');
    }
  }

  loginBtn.addEventListener('click', handleLogin);

  // Enter key
  [emailInput, passwordInput].forEach(function(input) {
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') handleLogin();
    });
  });
})();

// ===== ENV BADGE =====
(function() {
  const envEl = document.getElementById('hero-env');
  if (!envEl) return;
  const host = window.location.hostname;
  envEl.textContent = (host === 'localhost' || host === '127.0.0.1') ? 'LOCAL' : 'PRODUCTION';
})();
