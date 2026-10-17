/**
 * HandRaw Style Studio - 画廊浏览与选择器模块 (Gallery)
 * 渲染 331 种手绘风格、166 种排版图型与 36 种经典单色
 */

export const Gallery = {
  data: {
    styles: [],
    layouts: [],
    colors: [],
    tones: [],
    groups: []
  },

  activeTab: 'styles',      // 'styles' | 'layouts' | 'colors' | 'fusion'
  selectedCategory: 'ALL',  // 分类过滤器
  searchQuery: '',

  // 当前选中状态
  selections: {
    style: null,            // 单风格模式下的风格
    roleStyle: null,        // 融合模式：角色风格
    sceneStyle: null,       // 融合模式：场景风格
    layout: null,           // 排版图型
    color: null,            // 主题色
    tone: null              // 影调
  },

  fusionTarget: 'role',     // 融合模式下正在选择哪一个: 'role' | 'scene'

  async init() {
    await this.fetchData();
    this.bindEvents();
    this.render();
  },

  async fetchData() {
    try {
      const resp = await fetch('/api/data');
      if (resp.ok) {
        this.data = await resp.json();
      }
    } catch (e) {
      console.error('Failed to load gallery data:', e);
    }
  },

  setTab(tab) {
    this.activeTab = tab;
    this.selectedCategory = 'ALL';
    this.searchQuery = '';
    const searchInput = document.getElementById('gallery-search-input');
    if (searchInput) searchInput.value = '';

    // 更新导航高亮
    document.querySelectorAll('.nav-tab').forEach(el => {
      el.classList.toggle('active', el.getAttribute('data-tab') === tab);
    });

    this.render();
  },

  render() {
    this.renderToolbar();
    if (this.activeTab === 'styles') {
      this.renderStyles();
    } else if (this.activeTab === 'layouts') {
      this.renderLayouts();
    } else if (this.activeTab === 'colors') {
      this.renderColors();
    } else if (this.activeTab === 'fusion') {
      this.renderFusionSelector();
    }
  },

  renderToolbar() {
    const pillsContainer = document.getElementById('filter-pills-container');
    if (!pillsContainer) return;

    if (this.activeTab === 'styles' || this.activeTab === 'fusion') {
      const groups = [
        { code: 'ALL', name: '全部风格' },
        { code: 'FA', name: 'FA 幽默涂鸦' },
        { code: 'FB', name: 'FB 儿童绘本' },
        { code: 'FC', name: 'FC 复古美漫' },
        { code: 'FD', name: 'FD 水墨水彩' },
        { code: 'FE', name: 'FE 版画木刻' },
        { code: 'FF', name: 'FF 抽象构成' },
        { code: 'FG', name: 'FG 极简线条' },
        { code: 'FH', name: 'FH 装饰插画' }
      ];
      pillsContainer.innerHTML = groups.map(g => `
        <button type="button" class="filter-pill ${this.selectedCategory === g.code ? 'active' : ''}" data-cat="${g.code}">
          ${g.name}
        </button>
      `).join('');
    } else if (this.activeTab === 'layouts') {
      const layoutCategories = [
        { code: 'ALL', name: '全部排版 (166)' },
        { code: 'social-card', name: '社媒卡片 (SC)' },
        { code: 'infographic', name: '知识信息图 (IG)' },
        { code: 'storyboard', name: '漫画分镜 (SB)' },
        { code: 'character', name: 'IP三视图 (IP)' },
        { code: 'ecommerce', name: '电商图型 (EC)' }
      ];
      pillsContainer.innerHTML = layoutCategories.map(c => `
        <button type="button" class="filter-pill ${this.selectedCategory === c.code ? 'active' : ''}" data-cat="${c.code}">
          ${c.name}
        </button>
      `).join('');
    } else if (this.activeTab === 'colors') {
      pillsContainer.innerHTML = `
        <button type="button" class="filter-pill active" data-cat="ALL">全部 36 款经典单色</button>
      `;
    }

    // 绑定分类点击
    pillsContainer.querySelectorAll('.filter-pill').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.selectedCategory = e.currentTarget.getAttribute('data-cat');
        this.render();
      });
    });
  },

  renderStyles() {
    const grid = document.getElementById('gallery-items-grid');
    if (!grid) return;

    const query = this.searchQuery.toLowerCase();
    const filtered = this.data.styles.filter(s => {
      const matchCat = this.selectedCategory === 'ALL' || (s.number && s.number.startsWith(this.selectedCategory));
      if (!matchCat) return false;
      if (!query) return true;
      return (s.number && s.number.toLowerCase().includes(query)) ||
             (s.generation_name && s.generation_name.toLowerCase().includes(query)) ||
             (s.reference && s.reference.toLowerCase().includes(query)) ||
             (s.traits && s.traits.toLowerCase().includes(query));
    });

    if (!filtered.length) {
      grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted)">未找到匹配的风格</div>`;
      return;
    }

    grid.innerHTML = filtered.map(s => {
      const isSelected = this.selections.style && this.selections.style.number === s.number;
      // 真实大图路径
      const prefix = s.number.slice(0, 2);
      const imgPath = `/images/individual/${prefix}/${s.number}.webp`;

      return `
        <div class="style-item-card ${isSelected ? 'selected' : ''}" data-number="${s.number}">
          <div class="style-thumb-box">
            <span class="style-num-badge">#${s.number}</span>
            <span class="style-select-check">✓</span>
            <img class="style-thumb-img" src="${imgPath}" alt="${s.generation_name}" loading="lazy" onerror="this.src='/images/individual/FA/FA-001.webp'">
          </div>
          <div class="style-card-body">
            <div class="style-card-name" title="${s.generation_name}">${s.generation_name}</div>
            <div class="style-card-ref" title="${s.reference}">${s.reference}</div>
          </div>
        </div>
      `;
    }).join('');

    // 绑定点击选中
    grid.querySelectorAll('.style-item-card').forEach(card => {
      card.addEventListener('click', () => {
        const num = card.getAttribute('data-number');
        const style = this.data.styles.find(s => s.number === num);
        this.selectStyle(style);
      });
    });
  },

  renderLayouts() {
    const grid = document.getElementById('gallery-items-grid');
    if (!grid) return;

    const query = this.searchQuery.toLowerCase();
    const filtered = this.data.layouts.filter(l => {
      const matchCat = this.selectedCategory === 'ALL' || l.category === this.selectedCategory;
      if (!matchCat) return false;
      if (!query) return true;
      return (l.id && l.id.toLowerCase().includes(query)) ||
             (l.name && l.name.toLowerCase().includes(query)) ||
             (l.name_en && l.name_en.toLowerCase().includes(query)) ||
             (l.keywords && l.keywords.some(k => k.toLowerCase().includes(query)));
    });

    if (!filtered.length) {
      grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted)">未找到匹配的排版图型</div>`;
      return;
    }

    grid.innerHTML = filtered.map(l => {
      const isSelected = this.selections.layout && this.selections.layout.id === l.id;
      // 修正图片路径：如 l.image 是 ../../../images/layouts/social-cards/SC-001.webp 转为 /images/layouts/...
      let imgPath = l.image || '';
      if (imgPath.includes('images/layouts/')) {
        imgPath = '/images/layouts/' + imgPath.split('images/layouts/')[1];
      }

      return `
        <div class="style-item-card ${isSelected ? 'selected' : ''}" data-id="${l.id}">
          <div class="style-thumb-box">
            <span class="style-num-badge">${l.id}</span>
            <span class="style-select-check">✓</span>
            <img class="style-thumb-img" src="${imgPath}" alt="${l.name}" loading="lazy">
          </div>
          <div class="style-card-body">
            <div class="style-card-name" title="${l.name}">${l.name}</div>
            <div class="style-card-ref" title="${l.name_en || ''}">${l.name_en || ''}</div>
          </div>
        </div>
      `;
    }).join('');

    grid.querySelectorAll('.style-item-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.getAttribute('data-id');
        const layout = this.data.layouts.find(l => l.id === id);
        this.selectLayout(layout);
      });
    });
  },

  renderColors() {
    const grid = document.getElementById('gallery-items-grid');
    if (!grid) return;

    const query = this.searchQuery.toLowerCase();
    const filtered = this.data.colors.filter(c => {
      if (!query) return true;
      return (c.id && c.id.toLowerCase().includes(query)) ||
             (c.name_zh && c.name_zh.toLowerCase().includes(query)) ||
             (c.name_en && c.name_en.toLowerCase().includes(query));
    });

    grid.innerHTML = filtered.map(c => {
      const isSelected = this.selections.color && this.selections.color.id === c.id;
      let imgPath = c.image || '';
      if (imgPath.includes('images/colors/')) {
        imgPath = '/images/colors/' + imgPath.split('images/colors/')[1];
      }

      return `
        <div class="color-item-card ${isSelected ? 'selected' : ''}" data-id="${c.id}">
          <div class="color-swatch-box">
            <img src="${imgPath}" style="width:100%;height:100%;object-fit:cover;" alt="${c.name_zh}">
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <strong style="font-size:12px;color:var(--text-primary);">${c.id}</strong>
            <span style="font-size:11.5px;color:var(--text-secondary);">${c.name_zh || c.name_en}</span>
          </div>
        </div>
      `;
    }).join('');

    grid.querySelectorAll('.color-item-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.getAttribute('data-id');
        const color = this.data.colors.find(c => c.id === id);
        this.selectColor(color);
      });
    });
  },

  renderFusionSelector() {
    // 跨媒介风格融合选择器
    const grid = document.getElementById('gallery-items-grid');
    if (!grid) return;

    const roleName = this.selections.roleStyle ? `#${this.selections.roleStyle.number} ${this.selections.roleStyle.generation_name}` : '未选择 (点击下方风格填入)';
    const sceneName = this.selections.sceneStyle ? (this.selections.sceneStyle.number ? `#${this.selections.sceneStyle.number} ${this.selections.sceneStyle.generation_name}` : this.selections.sceneStyle.name) : '未选择 (默认写实摄影)';

    const headerHtml = `
      <div style="grid-column: 1/-1; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 16px; margin-bottom: 8px;">
        <h3 style="font-size:14.5px;margin-bottom:8px;">🎭 跨媒介风格融合对偶配置</h3>
        <p style="font-size:12.5px;color:var(--text-muted);margin-bottom:12px;">构建“角色视觉语言 × 场景视觉语言”共存画面，请分别指定角色与场景风格：</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div style="border: 2px solid ${this.fusionTarget === 'role' ? 'var(--accent-primary)' : 'var(--border-subtle)'}; border-radius: var(--radius-md); padding: 10px; cursor: pointer;" id="btn-target-role">
            <div style="font-size:11px;font-weight:700;color:var(--text-muted);">① 角色视觉语言 ${this.fusionTarget === 'role' ? '👈 [正在选取]' : ''}</div>
            <div style="font-size:13px;font-weight:800;color:var(--text-primary);margin-top:4px;">${roleName}</div>
          </div>
          <div style="border: 2px solid ${this.fusionTarget === 'scene' ? 'var(--accent-primary)' : 'var(--border-subtle)'}; border-radius: var(--radius-md); padding: 10px; cursor: pointer;" id="btn-target-scene">
            <div style="font-size:11px;font-weight:700;color:var(--text-muted);">② 场景视觉语言 ${this.fusionTarget === 'scene' ? '👈 [正在选取]' : ''}</div>
            <div style="font-size:13px;font-weight:800;color:var(--text-primary);margin-top:4px;">${sceneName}</div>
          </div>
        </div>
        <div style="margin-top:10px;display:flex;gap:8px;">
          <button type="button" class="btn-pill" id="btn-quick-realistic">🌟 一键设场景为【写实摄影】</button>
        </div>
      </div>
    `;

    // 下方展示风格列表供选择
    const filtered = this.data.styles.filter(s => {
      const matchCat = this.selectedCategory === 'ALL' || (s.number && s.number.startsWith(this.selectedCategory));
      if (!matchCat) return false;
      if (!this.searchQuery) return true;
      const q = this.searchQuery.toLowerCase();
      return (s.number && s.number.toLowerCase().includes(q)) ||
             (s.generation_name && s.generation_name.toLowerCase().includes(q));
    });

    const cardsHtml = filtered.map(s => {
      const prefix = s.number.slice(0, 2);
      const imgPath = `/images/individual/${prefix}/${s.number}.webp`;
      const isRole = this.selections.roleStyle && this.selections.roleStyle.number === s.number;
      const isScene = this.selections.sceneStyle && this.selections.sceneStyle.number === s.number;

      return `
        <div class="style-item-card ${isRole || isScene ? 'selected' : ''}" data-number="${s.number}">
          <div class="style-thumb-box">
            <span class="style-num-badge">#${s.number}</span>
            <span class="style-select-check">${isRole ? '角色' : '场景'}</span>
            <img class="style-thumb-img" src="${imgPath}" alt="${s.generation_name}" loading="lazy">
          </div>
          <div class="style-card-body">
            <div class="style-card-name">${s.generation_name}</div>
            <div class="style-card-ref">${s.reference}</div>
          </div>
        </div>
      `;
    }).join('');

    grid.innerHTML = headerHtml + cardsHtml;

    // 绑定事件
    document.getElementById('btn-target-role')?.addEventListener('click', () => {
      this.fusionTarget = 'role';
      this.render();
    });
    document.getElementById('btn-target-scene')?.addEventListener('click', () => {
      this.fusionTarget = 'scene';
      this.render();
    });
    document.getElementById('btn-quick-realistic')?.addEventListener('click', () => {
      this.selections.sceneStyle = { name: '写实摄影', name_en: 'Realistic photography' };
      this.emitChange();
      this.render();
    });

    grid.querySelectorAll('.style-item-card').forEach(card => {
      card.addEventListener('click', () => {
        const num = card.getAttribute('data-number');
        const style = this.data.styles.find(s => s.number === num);
        if (this.fusionTarget === 'role') {
          this.selections.roleStyle = style;
          this.fusionTarget = 'scene'; // 自动流转到下一个
        } else {
          this.selections.sceneStyle = style;
        }
        this.emitChange();
        this.render();
      });
    });
  },

  selectStyle(style) {
    if (this.selections.style && this.selections.style.number === style.number) {
      this.selections.style = null; // 再次点击取消
    } else {
      this.selections.style = style;
    }
    this.emitChange();
    this.render();
  },

  selectLayout(layout) {
    if (this.selections.layout && this.selections.layout.id === layout.id) {
      this.selections.layout = null;
    } else {
      this.selections.layout = layout;
    }
    this.emitChange();
    this.render();
  },

  selectColor(color) {
    if (this.selections.color && this.selections.color.id === color.id) {
      this.selections.color = null;
    } else {
      this.selections.color = color;
    }
    this.emitChange();
    this.render();
  },

  removeSelection(type) {
    if (type === 'style') this.selections.style = null;
    if (type === 'layout') this.selections.layout = null;
    if (type === 'color') this.selections.color = null;
    if (type === 'roleStyle') this.selections.roleStyle = null;
    if (type === 'sceneStyle') this.selections.sceneStyle = null;
    this.emitChange();
    this.render();
  },

  emitChange() {
    window.dispatchEvent(new CustomEvent('handraw:selection-changed', {
      detail: { ...this.selections, activeTab: this.activeTab }
    }));
  },

  bindEvents() {
    // 搜索框
    const searchInput = document.getElementById('gallery-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.trim();
        this.render();
      });
    }

    // 标签切换
    document.querySelectorAll('.nav-tab').forEach(tabBtn => {
      tabBtn.addEventListener('click', (e) => {
        const tab = e.currentTarget.getAttribute('data-tab');
        this.setTab(tab);
      });
    });
  }
};
