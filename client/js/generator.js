/**
 * HandRaw Style Studio - 生图与改图执行控制器 (Generator)
 * 支持文生图、图生图·改图、跨媒介风格融合与历史画廊管理
 */

import { PromptBuilder } from './prompt-builder.js';
import { SettingsManager } from './settings.js';
import { Gallery } from './gallery.js';

export const Generator = {
  mode: 'text2img',       // 'text2img' | 'img2edit' | 'fusion'
  isGenerating: false,
  timerInterval: null,
  currentGeneratedImage: null,
  baseImageData: null,    // 改图底图 (Base64 或 /history-images/...)

  init() {
    this.bindEvents();
    this.bindSelectionListener();
    this.updatePromptPreview();
    this.fetchHistory();
  },

  setMode(mode) {
    this.mode = mode;
    document.querySelectorAll('.mode-pill').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-mode') === mode);
    });

    const editBox = document.getElementById('edit-mode-section');
    if (editBox) {
      editBox.style.display = mode === 'img2edit' ? 'flex' : 'none';
    }

    const submitBtnText = document.getElementById('btn-submit-action-text');
    if (submitBtnText) {
      if (mode === 'img2edit') submitBtnText.textContent = '🖌️ 立即智能改图';
      else if (mode === 'fusion') submitBtnText.textContent = '🎭 立即生成风格融合大图';
      else submitBtnText.textContent = '🎨 立即生成手绘插画';
    }

    this.updatePromptPreview();
  },

  bindSelectionListener() {
    window.addEventListener('handraw:selection-changed', () => {
      this.renderActiveSelectionTags();
      this.updatePromptPreview();
    });
  },

  renderActiveSelectionTags() {
    const bar = document.getElementById('active-selections-bar');
    if (!bar) return;

    const sel = Gallery.selections;
    const tags = [];

    if (this.mode === 'fusion') {
      if (sel.roleStyle) {
        tags.push(`
          <span class="selection-tag">
            <span class="tag-label">角色风格:</span>
            <span class="tag-val">#${sel.roleStyle.number} ${sel.roleStyle.generation_name}</span>
            <button type="button" class="tag-close" data-remove="roleStyle">×</button>
          </span>
        `);
      }
      if (sel.sceneStyle) {
        tags.push(`
          <span class="selection-tag">
            <span class="tag-label">场景风格:</span>
            <span class="tag-val">${sel.sceneStyle.number ? '#' + sel.sceneStyle.number : ''} ${sel.sceneStyle.generation_name || sel.sceneStyle.name}</span>
            <button type="button" class="tag-close" data-remove="sceneStyle">×</button>
          </span>
        `);
      }
    } else {
      if (sel.style) {
        tags.push(`
          <span class="selection-tag">
            <span class="tag-label">画风:</span>
            <span class="tag-val">#${sel.style.number} ${sel.style.generation_name}</span>
            <button type="button" class="tag-close" data-remove="style">×</button>
          </span>
        `);
      }
    }

    if (sel.layout) {
      tags.push(`
        <span class="selection-tag">
          <span class="tag-label">排版:</span>
          <span class="tag-val">${sel.layout.id} ${sel.layout.name}</span>
          <button type="button" class="tag-close" data-remove="layout">×</button>
        </span>
      `);
    }

    if (sel.color) {
      tags.push(`
        <span class="selection-tag">
          <span class="tag-label">配色:</span>
          <span class="tag-val">${sel.color.id} ${sel.color.name_zh || sel.color.name_en}</span>
          <button type="button" class="tag-close" data-remove="color">×</button>
        </span>
      `);
    }

    const moodSelect = document.getElementById('select-mood');
    if (moodSelect && moodSelect.value) {
      tags.push(`
        <span class="selection-tag">
          <span class="tag-label">情绪:</span>
          <span class="tag-val">${moodSelect.value}</span>
        </span>
      `);
    }

    if (!tags.length) {
      bar.innerHTML = '<span style="font-size:12px;color:var(--text-muted)">👈 请在左侧画廊中点击挑选风格、排版与主题色</span>';
    } else {
      bar.innerHTML = tags.join('');
      bar.querySelectorAll('.tag-close').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const type = e.currentTarget.getAttribute('data-remove');
          Gallery.removeSelection(type);
        });
      });
    }
  },

  updatePromptPreview() {
    const themeInput = document.getElementById('input-theme');
    const moodSelect = document.getElementById('select-mood');
    const arSelect = document.getElementById('select-aspect-ratio');
    const textModeCheck = document.getElementById('check-text-mode');
    const previewZhEl = document.getElementById('prompt-preview-zh');

    const theme = themeInput ? themeInput.value.trim() : '';
    const mood = moodSelect ? moodSelect.value : '紧张';
    const aspectRatio = arSelect ? arSelect.value : '1:1';
    const isTextMode = textModeCheck ? textModeCheck.checked : false;

    let result = { zh: '', en: '' };

    if (this.mode === 'fusion') {
      result = PromptBuilder.buildFusionPrompt({
        roleStyle: Gallery.selections.roleStyle,
        sceneStyle: Gallery.selections.sceneStyle,
        theme: theme || '一个小人在桌子上努力拉拢一根断裂的绳子，纯色背景',
        mood: mood,
        color: Gallery.selections.color,
        aspectRatio: aspectRatio
      });
    } else {
      result = PromptBuilder.buildSinglePrompt({
        style: Gallery.selections.style,
        layout: Gallery.selections.layout,
        color: Gallery.selections.color,
        tone: Gallery.selections.tone,
        theme: theme || '一个小人在桌子上努力拉拢一根断裂的绳子，纯色背景',
        mood: mood,
        aspectRatio: aspectRatio,
        isTextMode: isTextMode
      });
    }

    if (previewZhEl) {
      previewZhEl.textContent = result.zh || '（请在上方输入主题即可实时生成标准提示词）';
    }
    this.currentPrompt = result;
  },

  async handleGenerate() {
    if (this.isGenerating) return;

    const settings = SettingsManager.getSettings();
    if (!settings.base_url) {
      alert('请先在顶部【API 设置】中配置 Base URL 与 API Key！');
      document.getElementById('modal-settings')?.classList.add('open');
      return;
    }

    const themeInput = document.getElementById('input-theme');
    const theme = themeInput ? themeInput.value.trim() : '';
    if (!theme) {
      alert('请输入画面主题描述！');
      themeInput?.focus();
      return;
    }

    this.updatePromptPreview();
    const promptToSend = this.currentPrompt.zh;

    if (this.mode === 'img2edit') {
      if (!this.baseImageData) {
        alert('改图模式下请先上传或选择一张参考底图！');
        return;
      }
      await this.executeEdit(settings, promptToSend);
    } else {
      await this.executeText2Img(settings, promptToSend);
    }
  },

  async executeText2Img(settings, prompt) {
    this.startLoading('正在生成手绘插画大图...');
    const arSelect = document.getElementById('select-aspect-ratio');
    const ar = arSelect ? arSelect.value : '1:1';

    try {
      const resp = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base_url: settings.base_url,
          api_key: settings.api_key,
          model: settings.model || 'dall-e-3',
          prompt: prompt,
          aspect_ratio: ar,
          quality: settings.quality || 'standard',
          params_meta: {
            style: Gallery.selections.style?.number,
            layout: Gallery.selections.layout?.id,
            color: Gallery.selections.color?.id
          }
        })
      });

      const res = await resp.json();
      if (res.success && res.image) {
        this.renderGeneratedResult(res.image);
        this.fetchHistory();
      } else {
        alert(`生图失败: ${res.error || '未知错误'}`);
        this.resetCanvas();
      }
    } catch (e) {
      alert(`网络或请求异常: ${e.message}`);
      this.resetCanvas();
    } finally {
      this.stopLoading();
    }
  },

  async executeEdit(settings, prompt) {
    this.startLoading('正在根据参考底图进行修改重绘...');

    try {
      const resp = await fetch('/api/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base_url: settings.base_url,
          api_key: settings.api_key,
          model: settings.edit_model || 'dall-e-2',
          prompt: prompt,
          base_image: this.baseImageData,
          params_meta: {
            mode: 'img2img',
            style: Gallery.selections.style?.number
          }
        })
      });

      const res = await resp.json();
      if (res.success && res.image) {
        this.renderGeneratedResult(res.image);
        this.fetchHistory();
      } else {
        alert(`改图失败: ${res.error || '未知错误'}`);
        this.resetCanvas();
      }
    } catch (e) {
      alert(`改图请求异常: ${e.message}`);
      this.resetCanvas();
    } finally {
      this.stopLoading();
    }
  },

  renderGeneratedResult(imageItem) {
    this.currentGeneratedImage = imageItem;
    const emptyState = document.getElementById('canvas-empty-state');
    const loadingState = document.getElementById('canvas-loading-state');
    const displayImg = document.getElementById('canvas-display-img');
    const actionBar = document.getElementById('canvas-action-bar');
    const metaInfo = document.getElementById('canvas-image-meta');

    if (emptyState) emptyState.style.display = 'none';
    if (loadingState) loadingState.style.display = 'none';

    if (displayImg) {
      displayImg.src = imageItem.url;
      displayImg.style.display = 'block';
    }

    if (actionBar) actionBar.style.display = 'flex';
    if (metaInfo) {
      metaInfo.textContent = `${imageItem.model} · 耗时 ${imageItem.elapsed_sec || 0}s · ${imageItem.time_str}`;
    }
  },

  startLoading(message) {
    this.isGenerating = true;
    const btn = document.getElementById('btn-submit-action');
    if (btn) btn.disabled = true;

    const emptyState = document.getElementById('canvas-empty-state');
    const loadingState = document.getElementById('canvas-loading-state');
    const displayImg = document.getElementById('canvas-display-img');
    const actionBar = document.getElementById('canvas-action-bar');
    const statusText = document.getElementById('loading-status-text');
    const timerText = document.getElementById('loading-timer-text');

    if (emptyState) emptyState.style.display = 'none';
    if (displayImg) displayImg.style.display = 'none';
    if (actionBar) actionBar.style.display = 'none';
    if (loadingState) loadingState.style.display = 'flex';
    if (statusText) statusText.textContent = message;

    let seconds = 0;
    if (timerText) timerText.textContent = '0.0s';
    this.timerInterval = setInterval(() => {
      seconds += 0.1;
      if (timerText) timerText.textContent = seconds.toFixed(1) + 's';
    }, 100);
  },

  stopLoading() {
    this.isGenerating = false;
    const btn = document.getElementById('btn-submit-action');
    if (btn) btn.disabled = false;
    clearInterval(this.timerInterval);
  },

  resetCanvas() {
    const emptyState = document.getElementById('canvas-empty-state');
    const loadingState = document.getElementById('canvas-loading-state');
    const displayImg = document.getElementById('canvas-display-img');
    const actionBar = document.getElementById('canvas-action-bar');

    if (loadingState) loadingState.style.display = 'none';
    if (this.currentGeneratedImage) {
      if (displayImg) displayImg.style.display = 'block';
      if (actionBar) actionBar.style.display = 'flex';
    } else {
      if (emptyState) emptyState.style.display = 'flex';
      if (displayImg) displayImg.style.display = 'none';
      if (actionBar) actionBar.style.display = 'none';
    }
  },

  async fetchHistory() {
    try {
      const resp = await fetch('/api/history');
      if (resp.ok) {
        const data = await resp.json();
        this.renderHistoryList(data.history || []);
      }
    } catch (e) {
      console.warn('Failed to fetch history:', e);
    }
  },

  renderHistoryList(list) {
    const container = document.getElementById('history-items-grid');
    const countBadge = document.getElementById('history-count-badge');
    if (countBadge) countBadge.textContent = list.length;
    if (!container) return;

    if (!list.length) {
      container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 30px;">暂无生成历史</div>';
      return;
    }

    container.innerHTML = list.map(item => `
      <div class="history-card" data-id="${item.id}" data-url="${item.url}" title="点击查看并重新加载此图">
        <img class="history-thumb" src="${item.url}" loading="lazy" alt="history">
        <div class="history-info">
          <span>${item.type === 'img2edit' ? '改图' : '文生图'}</span>
          <span>${item.time_str.split(' ')[1]}</span>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('.history-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.getAttribute('data-id');
        const item = list.find(x => x.id === id);
        if (item) {
          this.renderGeneratedResult(item);
          document.getElementById('modal-history')?.classList.remove('open');
        }
      });
    });
  },

  bindEvents() {
    // 模式切换
    document.querySelectorAll('.mode-pill').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const m = e.currentTarget.getAttribute('data-mode');
        this.setMode(m);
      });
    });

    // 主题输入实时联动
    document.getElementById('input-theme')?.addEventListener('input', () => {
      this.updatePromptPreview();
    });

    document.getElementById('select-mood')?.addEventListener('change', () => {
      this.renderActiveSelectionTags();
      this.updatePromptPreview();
    });

    document.getElementById('select-aspect-ratio')?.addEventListener('change', () => {
      this.updatePromptPreview();
    });

    document.getElementById('check-text-mode')?.addEventListener('change', () => {
      this.updatePromptPreview();
    });

    // 快捷灵感短语点击
    document.querySelectorAll('.quick-tag').forEach(tag => {
      tag.addEventListener('click', (e) => {
        const input = document.getElementById('input-theme');
        if (input) {
          input.value = e.currentTarget.getAttribute('data-text');
          this.updatePromptPreview();
        }
      });
    });

    // 复制提示词
    document.getElementById('btn-copy-prompt')?.addEventListener('click', () => {
      if (this.currentPrompt && this.currentPrompt.zh) {
        navigator.clipboard.writeText(this.currentPrompt.zh).then(() => {
          alert('✓ 提示词已成功复制到剪贴板！');
        });
      }
    });

    // 主生图按钮
    document.getElementById('btn-submit-action')?.addEventListener('click', () => {
      this.handleGenerate();
    });

    // 结果工具栏操作
    document.getElementById('btn-canvas-download')?.addEventListener('click', () => {
      if (this.currentGeneratedImage) {
        const a = document.createElement('a');
        a.href = this.currentGeneratedImage.url;
        a.download = this.currentGeneratedImage.filename || 'handraw_output.png';
        a.click();
      }
    });

    // "发送到改图" 按钮
    document.getElementById('btn-canvas-to-edit')?.addEventListener('click', () => {
      if (this.currentGeneratedImage) {
        this.baseImageData = this.currentGeneratedImage.url;
        const thumb = document.getElementById('edit-thumb-img');
        if (thumb) {
          thumb.src = this.currentGeneratedImage.url;
          thumb.style.display = 'block';
        }
        this.setMode('img2edit');
        const themeInput = document.getElementById('input-theme');
        if (themeInput) {
          themeInput.value = '在保持原图角色姿态与手绘质感的前提下，将背景...';
          themeInput.focus();
        }
      }
    });

    // 底图文件上传监听
    const fileInput = document.getElementById('upload-base-image-file');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
          this.baseImageData = evt.target.result;
          const thumb = document.getElementById('edit-thumb-img');
          if (thumb) {
            thumb.src = this.baseImageData;
            thumb.style.display = 'block';
          }
        };
        reader.readAsDataURL(file);
      });
    }
  }
};
