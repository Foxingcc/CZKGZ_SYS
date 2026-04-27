document.addEventListener('DOMContentLoaded', function() {
    // 检查登录状态
    if (sessionStorage.getItem('isLoggedIn') !== 'true') {
        window.location.href = 'login.html';
        return;
    }

    // 加载用户信息
    loadUserInfo();

    // 初始化下拉菜单
    initUserDropdown();

    // 初始化编辑功能
    initEditForm();

    // 初始化修改密码模态框
    initPasswordModal();

    // 退出登录
    document.getElementById('logoutBtn').addEventListener('click', function(e) {
        e.preventDefault();
        logout();
    });
});

function loadUserInfo() {
    const username = sessionStorage.getItem('username') || '操作员';
    const userRole = sessionStorage.getItem('userRole') || '系统操作员';
    const userId = sessionStorage.getItem('userId') || 'CZK20240001';

    document.getElementById('displayUsername').textContent = username;
    document.getElementById('userName').textContent = username;
    document.getElementById('userRole').textContent = userRole;
    document.getElementById('userId').textContent = `工号: ${userId}`;
    document.getElementById('userAvatar').textContent = username.charAt(0).toUpperCase();
}

function initUserDropdown() {
    const userInfo = document.getElementById('userInfo');
    const userDropdown = document.getElementById('userDropdown');

    if (!userInfo || !userDropdown) return;

    userInfo.addEventListener('click', function(e) {
        e.stopPropagation();
        userInfo.classList.toggle('active');
    });

    document.addEventListener('click', function(e) {
        if (!userInfo.contains(e.target)) {
            userInfo.classList.remove('active');
        }
    });
}

function initEditForm() {
    const editBtn = document.getElementById('editBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const infoForm = document.getElementById('infoForm');
    const formActions = document.getElementById('formActions');
    const inputs = infoForm.querySelectorAll('input:not([type="checkbox"])');

    editBtn.addEventListener('click', function() {
        inputs.forEach(input => input.disabled = false);
        formActions.style.display = 'flex';
        editBtn.disabled = true;
        editBtn.style.opacity = '0.5';
        inputs[0].focus();
    });

    cancelBtn.addEventListener('click', function() {
        resetForm();
    });

    infoForm.addEventListener('submit', function(e) {
        e.preventDefault();
        saveUserInfo();
    });
}

function resetForm() {
    const infoForm = document.getElementById('infoForm');
    const formActions = document.getElementById('formActions');
    const editBtn = document.getElementById('editBtn');
    const inputs = infoForm.querySelectorAll('input:not([type="checkbox"])');

    inputs.forEach(input => input.disabled = true);
    formActions.style.display = 'none';
    editBtn.disabled = false;
    editBtn.style.opacity = '1';

    // 重置为原始值（实际项目中应该从服务器获取）
    document.getElementById('realName').value = '张三';
    document.getElementById('phone').value = '138****8888';
    document.getElementById('email').value = 'zhangsan@example.com';
    document.getElementById('department').value = '生产部 - 灌注车间';
    document.getElementById('position').value = '操作员';
    document.getElementById('entryDate').value = '2024-01-15';
}

function saveUserInfo() {
    const realName = document.getElementById('realName').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const email = document.getElementById('email').value.trim();
    const department = document.getElementById('department').value.trim();
    const position = document.getElementById('position').value.trim();
    const entryDate = document.getElementById('entryDate').value;

    // 简单验证
    if (!realName || !phone || !email) {
        alert('请填写完整的信息');
        return;
    }

    // 邮箱格式验证
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        alert('请输入有效的邮箱地址');
        return;
    }

    // 手机号格式验证
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(phone.replace(/\*/g, ''))) {
        alert('请输入有效的手机号码');
        return;
    }

    // 模拟保存（实际项目中应该调用API）
    console.log('保存用户信息:', { realName, phone, email, department, position, entryDate });

    // 显示成功提示
    showNotification('个人信息已更新');

    // 重置表单状态
    resetForm();
}

function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 16px 24px;
        background: linear-gradient(135deg, rgba(74, 222, 128, 0.95) 0%, rgba(21, 128, 61, 0.95) 100%);
        color: white;
        border-radius: 10px;
        font-size: 14px;
        font-weight: 500;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
        z-index: 10000;
        animation: slideInRight 0.3s ease-out;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease-in forwards';
        setTimeout(() => notification.remove(), 300);
    }, 2000);
}

function initPasswordModal() {
    const modal = document.getElementById('passwordModal');
    const closeModal = document.getElementById('closeModal');
    const cancelPassword = document.getElementById('cancelPassword');
    const passwordForm = document.getElementById('passwordForm');

    window.showChangePasswordModal = function() {
        modal.classList.add('show');
    };

    closeModal.addEventListener('click', () => modal.classList.remove('show'));
    cancelPassword.addEventListener('click', () => modal.classList.remove('show'));

    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.classList.remove('show');
        }
    });

    passwordForm.addEventListener('submit', function(e) {
        e.preventDefault();
        changePassword();
    });
}

function changePassword() {
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    // 验证
    if (!currentPassword || !newPassword || !confirmPassword) {
        alert('请填写所有密码字段');
        return;
    }

    if (newPassword.length < 6) {
        alert('新密码长度至少6位');
        return;
    }

    if (newPassword !== confirmPassword) {
        alert('两次输入的新密码不一致');
        return;
    }

    // 模拟密码修改（实际项目中应该调用API）
    console.log('修改密码:', { currentPassword, newPassword });

    // 显示成功提示
    showNotification('密码修改成功');

    // 关闭模态框并重置表单
    document.getElementById('passwordModal').classList.remove('show');
    document.getElementById('passwordForm').reset();
}

function logout() {
    if (confirm('确定要退出登录吗？')) {
        sessionStorage.clear();
        window.location.href = 'login.html';
    }
}
