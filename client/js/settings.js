/**
 * HandRaw Style Studio - 服务商与中转站管理模块 (Settings & Partners)
 * 支持官方渠道、精选第三方中转商（带拉新/返佣链接）与自定义中转站
 */

export const SettingsManager = {
  storageKey: 'handraw_studio_settings',
  partners: [],

  // 默认配置
  defaultSettings: {
    provider_id: 'zerotoken',
    base_url: 'https://api.zerotoken.cn/v1',
    api_key: '',
    model: 'dall-e-3',
    edit_model: 'dall-e-2',
    quality: 'standard'
  },

  currentSettings: null,

  init() {
    this.loadSettings();
    this.fetchPartners();
    this.bindEvents();
  },

  loadSettings() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      this.currentSettings = saved ? { ...this.defaultSettings, ...jsonParseSafe(saved) } : { ...this.defaultSettings };
    } catch {
      this.currentSettings = { ...this.defaultSettings };
    }
    this.syncFormToUI();
  },

  saveSettings(newSettings) {
    this.currentSettings = { ...this.currentSettings, ...newSettings };
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.currentSettings));
    } catch (e) {
      console.error('Failed to save settings to localStorage', e);
    }
    this.syncFormToUI();
    window.dispatchEvent(new CustomEvent('handraw:settings-changed', { detail: this.currentSettings }));
  },

  getSettings() {
    if (!this.currentSettings) this.loadSettings();
    return this.currentSettings;
  },

  async fetchPartners() {
    try {
      const resp = await fetch('/api/partners');
      if (resp.ok) {
        const data = await resp.json();
        this.partners = data.partners || [];
        this.renderPartnersList();
      }
    } catch (err) {
      console.warn('Failed to fetch partners list:', err);
    }
  },

  renderPartnersList() {
    const container = document.getElementById('partners-list-container');
    if (!container) return;

    if (!this.partners.length) {
      container.innerHTML = '<div class="text-muted text-sm">暂无推荐服务商</div>';
      return;
    }

    container.innerHTML = this.partners.map(p => {
      const isSelected = this.currentSettings.provider_id === p.id;
      return `
        <div class="partner-card ${isSelected ? 'selected' : ''}" data-id="${p.id}">
          <div class="partner-header">
            <div class="partner-name">
              <span>${p.icon || '⚡'}</span>
              <strong>${p.name}</strong>
            </div>
            ${p.badge ? `<span class="partner-badge">${p.badge}</span>` : ''}
          </div>
          <div class="partner-tagline">${p.tagline}</div>
          ${p.notes ? `<div style="font-size:11.5px;color:var(--text-muted);">${p.notes}</div>` : ''}
          <div class="partner-actions">
            ${p.referral_url ? `
              <a href="${p.referral_url}" target="_blank" class="btn-affiliate" title="点击注册并领取免费额度/折扣">
                🎁 注册领取 Key / 福利
              </a>
            ` : ''}
            <button type="button" class="btn-use-preset" data-id="${p.id}">
              ${isSelected ? '✓ 当前正在使用' : '一键使用此通道'}
            </button>
          </div>
        </div>
      `;
    }).join('');

    // 绑定预设选择事件
    container.querySelectorAll('.btn-use-preset').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        this.applyPartnerPreset(id);
      });
    });
  },

  applyPartnerPreset(partnerId) {
    const partner = this.partners.find(p => p.id === partnerId);
    if (!partner) return;

    this.saveSettings({
      provider_id: partner.id,
      base_url: partner.base_url,
      model: partner.default_model,
      edit_model: partner.edit_model || 'dall-e-2'
    });

    this.renderPartnersList();
    alert(`已为您一键切换为【${partner.name}】！\n请在下方粘贴您在该平台领取的 API Key 即可直接生图。`);
  },

  syncFormToUI() {
    const s = this.currentSettings;
    const baseUrlInput = document.getElementById('setting-base-url');
    const apiKeyInput = document.getElementById('setting-api-key');
    const modelInput = document.getElementById('setting-model');
    const editModelInput = document.getElementById('setting-edit-model');
    const qualitySelect = document.getElementById('setting-quality');
    const providerBadge = document.getElementById('current-provider-badge');

    if (baseUrlInput) baseUrlInput.value = s.base_url || '';
    if (apiKeyInput) apiKeyInput.value = s.api_key || '';
    if (modelInput) modelInput.value = s.model || 'dall-e-3';
    if (editModelInput) editModelInput.value = s.edit_model || 'dall-e-2';
    if (qualitySelect) qualitySelect.value = s.quality || 'standard';

    if (providerBadge) {
      const matched = this.partners.find(p => p.id === s.provider_id);
      providerBadge.textContent = matched ? `${matched.name} · ${s.model}` : (s.model || '未配置 API');
    }
  },

  bindEvents() {
    const saveBtn = document.getElementById('btn-save-settings');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        const baseUrl = document.getElementById('setting-base-url')?.value.trim();
        const apiKey = document.getElementById('setting-api-key')?.value.trim();
        const model = document.getElementById('setting-model')?.value.trim();
        const editModel = document.getElementById('setting-edit-model')?.value.trim();
        const quality = document.getElementById('setting-quality')?.value;

        this.saveSettings({
          base_url: baseUrl,
          api_key: apiKey,
          model: model,
          edit_model: editModel,
          quality: quality
        });

        const statusEl = document.getElementById('settings-status-msg');
        if (statusEl) {
          statusEl.textContent = '✓ 设置已保存生效！';
          setTimeout(() => { statusEl.textContent = ''; }, 2500);
        }
      });
    }

    // 测试连接按钮
    const testBtn = document.getElementById('btn-test-connection');
    if (testBtn) {
      testBtn.addEventListener('click', async () => {
        const baseUrl = document.getElementById('setting-base-url')?.value.trim();
        const apiKey = document.getElementById('setting-api-key')?.value.trim();
        const statusEl = document.getElementById('settings-status-msg');

        if (!baseUrl) {
          alert('请先输入 Base URL');
          return;
        }

        testBtn.disabled = true;
        testBtn.textContent = '测试中...';
        if (statusEl) statusEl.textContent = '正在检测网络与接口连通性...';

        try {
          const resp = await fetch('/api/test-connection', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ base_url: baseUrl, api_key: apiKey })
          });
          const res = await resp.json();
          if (res.success) {
            statusEl.innerHTML = `<span style="color:var(--accent-green)">🟢 ${res.message}</span>`;
          } else {
            statusEl.innerHTML = `<span style="color:var(--accent-primary)">🔴 ${res.error || '连接失败'}</span>`;
          }
        } catch (e) {
          statusEl.innerHTML = `<span style="color:var(--accent-primary)">🔴 请求出错: ${e.message}</span>`;
        } finally {
          testBtn.disabled = false;
          testBtn.textContent = '测试连接';
        }
      });
    }
  }
};

function jsonParseSafe(str) {
  try { return JSON.parse(str); } catch { return {}; }
}
