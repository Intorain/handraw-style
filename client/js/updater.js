/**
 * HandRaw Style Studio - 升级检测与一键更新模块 (Updater)
 * 深度参照 Codex (e:\openProject\codex) 升级提醒与一键升级机制
 */

export const Updater = {
  versionData: null,

  async init() {
    this.bindEvents();
    await this.checkUpdate(false);
  },

  async checkUpdate(showFeedback = true) {
    const badgeEl = document.getElementById('navbar-update-badge');
    if (badgeEl && showFeedback) {
      badgeEl.textContent = '检查中...';
    }

    try {
      const resp = await fetch('/api/version');
      if (resp.ok) {
        this.versionData = await resp.json();
        this.renderBadge();
        if (showFeedback && !this.versionData.has_update) {
          alert(`当前已是最新版本 (${this.versionData.current_version})！暂无可用更新。`);
        }
      }
    } catch (e) {
      console.warn('Failed to check version:', e);
      if (badgeEl) badgeEl.textContent = '版本 v1.0.0';
    }
  },

  renderBadge() {
    const badgeEl = document.getElementById('navbar-update-badge');
    if (!badgeEl || !this.versionData) return;

    const { current_version, latest_version, has_update } = this.versionData;

    if (has_update) {
      badgeEl.className = 'update-badge';
      badgeEl.innerHTML = `🔔 发现新版本 <strong>v${latest_version}</strong> (点击升级)`;
      badgeEl.title = `从当前 v${current_version} 升级至 v${latest_version}`;
    } else {
      badgeEl.className = 'update-badge up-to-date';
      badgeEl.innerHTML = `✨ v${current_version} (最新)`;
      badgeEl.title = '点击重新检查更新';
    }
  },

  openUpdateModal() {
    const modal = document.getElementById('modal-update');
    if (!modal || !this.versionData) return;

    const curVerEl = document.getElementById('update-current-version');
    const latestVerEl = document.getElementById('update-latest-version');
    const changelogList = document.getElementById('update-changelog-list');
    const doUpdateBtn = document.getElementById('btn-do-upgrade');
    const updateStatusMsg = document.getElementById('update-status-msg');

    if (curVerEl) curVerEl.textContent = `v${this.versionData.current_version}`;
    if (latestVerEl) latestVerEl.textContent = `v${this.versionData.latest_version}`;
    if (updateStatusMsg) updateStatusMsg.textContent = '';

    if (changelogList) {
      const logs = this.versionData.changelog || [];
      changelogList.innerHTML = logs.map(item => `<li>${item}</li>`).join('');
    }

    if (doUpdateBtn) {
      doUpdateBtn.disabled = !this.versionData.has_update;
      doUpdateBtn.textContent = this.versionData.has_update ? '🚀 立即一键升级' : '当前已是最新版';
    }

    modal.classList.add('open');
  },

  closeUpdateModal() {
    const modal = document.getElementById('modal-update');
    if (modal) modal.classList.remove('open');
  },

  async executeUpgrade() {
    const doUpdateBtn = document.getElementById('btn-do-upgrade');
    const updateStatusMsg = document.getElementById('update-status-msg');

    if (doUpdateBtn) {
      doUpdateBtn.disabled = true;
      doUpdateBtn.textContent = '正在升级中，请稍候...';
    }
    if (updateStatusMsg) {
      updateStatusMsg.innerHTML = '<span style="color:var(--accent-secondary)">⏳ 正在拉取远端更新包与代码，请勿关闭客户端...</span>';
    }

    try {
      const resp = await fetch('/api/upgrade', { method: 'POST' });
      const res = await resp.json();

      if (res.success) {
        if (updateStatusMsg) {
          updateStatusMsg.innerHTML = '<span style="color:var(--accent-green);font-weight:700">🎉 升级成功！客户端将在 2 秒后自动刷新页面...</span>';
        }
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        if (updateStatusMsg) {
          updateStatusMsg.innerHTML = `<span style="color:var(--accent-primary)">❌ 升级未完成：${res.message}</span>`;
        }
        if (doUpdateBtn) {
          doUpdateBtn.disabled = false;
          doUpdateBtn.textContent = '重试一键升级';
        }
      }
    } catch (e) {
      if (updateStatusMsg) {
        updateStatusMsg.innerHTML = `<span style="color:var(--accent-primary)">❌ 升级请求异常: ${e.message}</span>`;
      }
      if (doUpdateBtn) {
        doUpdateBtn.disabled = false;
        doUpdateBtn.textContent = '重试升级';
      }
    }
  },

  bindEvents() {
    const badgeEl = document.getElementById('navbar-update-badge');
    if (badgeEl) {
      badgeEl.addEventListener('click', () => {
        if (this.versionData && this.versionData.has_update) {
          this.openUpdateModal();
        } else {
          this.checkUpdate(true);
        }
      });
    }

    const closeBtn = document.getElementById('btn-close-update-modal');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closeUpdateModal());
    }

    const doUpdateBtn = document.getElementById('btn-do-upgrade');
    if (doUpdateBtn) {
      doUpdateBtn.addEventListener('click', () => this.executeUpgrade());
    }
  }
};
