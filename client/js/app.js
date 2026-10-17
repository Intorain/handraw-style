/**
 * HandRaw Style Studio - 客户端应用主入口 (Main App)
 */

import { Gallery } from './gallery.js';
import { SettingsManager } from './settings.js';
import { Updater } from './updater.js';
import { Generator } from './generator.js';

document.addEventListener('DOMContentLoaded', () => {
  // 1. 初始化主题
  initTheme();

  // 2. 初始化核心功能模块
  SettingsManager.init();
  Gallery.init();
  Generator.init();
  Updater.init();

  // 3. 模态框全局控制
  initModals();
});

function initTheme() {
  const savedTheme = localStorage.getItem('handraw_theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);

  const themeBtn = document.getElementById('btn-toggle-theme');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'light';
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('handraw_theme', next);
      updateThemeIcon(next);
    });
  }
}

function updateThemeIcon(theme) {
  const icon = document.getElementById('theme-icon');
  if (icon) {
    icon.textContent = theme === 'dark' ? '☀️' : '🌙';
  }
}

function initModals() {
  // 设置弹窗
  const btnSettings = document.getElementById('btn-open-settings');
  const modalSettings = document.getElementById('modal-settings');
  const btnCloseSettings = document.getElementById('btn-close-settings');

  if (btnSettings && modalSettings) {
    btnSettings.addEventListener('click', () => modalSettings.classList.add('open'));
  }
  if (btnCloseSettings && modalSettings) {
    btnCloseSettings.addEventListener('click', () => modalSettings.classList.remove('open'));
  }

  // 历史记录弹窗
  const btnHistory = document.getElementById('btn-open-history');
  const modalHistory = document.getElementById('modal-history');
  const btnCloseHistory = document.getElementById('btn-close-history');

  if (btnHistory && modalHistory) {
    btnHistory.addEventListener('click', () => {
      Generator.fetchHistory();
      modalHistory.classList.add('open');
    });
  }
  if (btnCloseHistory && modalHistory) {
    btnCloseHistory.addEventListener('click', () => modalHistory.classList.remove('open'));
  }

  // 点击外部阴影区域关闭
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.remove('open');
      }
    });
  });
}
