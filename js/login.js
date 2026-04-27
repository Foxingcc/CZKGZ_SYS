document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const togglePasswordBtn = document.getElementById('togglePassword');
    const submitBtn = document.getElementById('submitBtn');
    const errorMessage = document.getElementById('errorMessage');

    // 检查登录状态
    if (sessionStorage.getItem('isLoggedIn') === 'true') {
        window.location.href = 'index.html';
        return;
    }

    // 初始化交互功能
    initPasswordToggle();
    initFormValidation();
    loadRememberedUser();

    // 密码可见性切换
    function initPasswordToggle() {
        if (!togglePasswordBtn) return;

        togglePasswordBtn.addEventListener('click', function() {
            const type = passwordInput.type === 'password' ? 'text' : 'password';
            passwordInput.type = type;

            const eyeOpen = this.querySelector('.icon-eye-open');
            const eyeClosed = this.querySelector('.icon-eye-closed');

            if (type === 'text') {
                eyeOpen.style.display = 'none';
                eyeClosed.style.display = 'block';
                this.title = '隐藏密码';
            } else {
                eyeOpen.style.display = 'block';
                eyeClosed.style.display = 'none';
                this.title = '显示密码';
            }
        });
    }

    // 表单验证与提交
    function initFormValidation() {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const username = usernameInput.value.trim();
            const password = passwordInput.value;

            // 验证输入
            if (!username || !password) {
                showError('请输入用户名和密码');
                shakeElement(loginForm);
                return;
            }

            // 显示加载状态
            setLoading(true);
            hideError();

            // 模拟登录请求
            await new Promise(resolve => setTimeout(resolve, 1500));

            // 验证凭据
            if (username === 'admin' && password === 'admin123') {
                handleLoginSuccess(username, '管理员', '系统管理员', 'ADMIN001');
            } else if (username === 'operator' && password === 'operator123') {
                handleLoginSuccess(username, '操作员', '系统操作员', 'CZK20240001');
            } else {
                handleLoginFailure();
            }
        });

        // 回车键提交
        passwordInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                loginForm.dispatchEvent(new Event('submit'));
            }
        });
    }

    // 登录成功处理
    function handleLoginSuccess(username, displayName, role, userId) {
        sessionStorage.setItem('isLoggedIn', 'true');
        sessionStorage.setItem('username', displayName);
        sessionStorage.setItem('userRole', role);
        sessionStorage.setItem('userId', userId);

        // 保存记住的用户名
        if (document.getElementById('rememberMe').checked) {
            localStorage.setItem('rememberedUser', username);
        } else {
            localStorage.removeItem('rememberedUser');
        }

        // 成功动画反馈 - 卡片发光效果
        const glassCard = document.querySelector('.glass-card');
        if (glassCard) {
            glassCard.style.transition = 'all 0.5s ease';
            glassCard.style.boxShadow = 
                '0 0 50px rgba(0, 212, 170, 0.4), ' +
                '0 0 100px rgba(0, 212, 170, 0.2), ' +
                'inset 0 1.5px 0 rgba(0, 212, 170, 0.6)';
            glassCard.style.borderColor = '#00d4aa';
            
            // 更新按钮样式
            submitBtn.style.background = 'linear-gradient(135deg, #00d4aa 0%, #00b894 100%)';
            submitBtn.querySelector('.btn-label').textContent = '成功';
        }

        setTimeout(() => {
            window.location.href = 'index.html';
        }, 600);
    }

    // 登录失败处理
    function handleLoginFailure() {
        showError('用户名或密码错误，请重新输入');
        setLoading(false);
        
        // 表单抖动反馈
        shakeElement(loginForm);

        // 按钮抖动 + 边框闪烁
        submitBtn.style.animation = 'errorShake 0.5s ease-in-out';
        setTimeout(() => {
            submitBtn.style.animation = '';
        }, 500);

        // 卡片边框红色闪烁
        const glassCard = document.querySelector('.glass-card');
        if (glassCard) {
            glassCard.style.borderColor = '#ef4444';
            setTimeout(() => {
                glassCard.style.borderColor = '';
            }, 1000);
        }
    }

    // 显示错误信息
    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.classList.add('show');

        // 自动隐藏
        setTimeout(hideError, 4000);
    }

    // 隐藏错误信息
    function hideError() {
        errorMessage.classList.remove('show');
    }

    // 设置加载状态
    function setLoading(loading) {
        if (loading) {
            submitBtn.classList.add('loading');
            submitBtn.disabled = true;
            submitBtn.querySelector('.btn-label').textContent = '登录中...';
        } else {
            submitBtn.classList.remove('loading');
            submitBtn.disabled = false;
            submitBtn.querySelector('.btn-label').textContent = '登 录';
        }
    }

    // 元素抖动效果
    function shakeElement(element) {
        element.style.animation = 'none';
        element.offsetHeight; // 触发重排
        element.style.animation = 'errorShake 0.5s ease-in-out';

        setTimeout(() => {
            element.style.animation = '';
        }, 500);
    }

    // 加载记住的用户名
    function loadRememberedUser() {
        const rememberedUser = localStorage.getItem('rememberedUser');
        
        if (rememberedUser && usernameInput) {
            usernameInput.value = rememberedUser;
            document.getElementById('rememberMe').checked = true;
        }
    }
});
