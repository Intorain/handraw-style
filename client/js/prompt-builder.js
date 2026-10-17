/**
 * HandRaw Style Studio - 提示词组装引擎 (Prompt Builder)
 * 严格对齐 handdraw-style-prompter 与 style-fusion-prompter 标准
 */

export const PromptBuilder = {
  /**
   * 组装单风格生图提示词
   */
  buildSinglePrompt({ style, layout, color, tone, theme, mood, aspectRatio, isTextMode }) {
    if (!theme) return { zh: '', en: '' };

    const zhLines = [];
    const enLines = [];

    // 1. 核心画风展开 (严格完整保留核心特征，严禁压缩)
    if (style) {
      const num = style.number || '';
      const genName = style.generation_name || '';
      const ref = style.reference || '';
      const traits = style.traits || '';
      const traitsEn = style.traits_en || traits;

      zhLines.push(`画风：#${num} ${genName}。参考作者/风格名称：${ref}。核心风格特征：${traits}`);
      enLines.push(`Style: #${num} ${genName}. Reference author/style: ${ref}. Core style traits: ${traitsEn}`);
    }

    // 2. 排版图型
    if (layout) {
      zhLines.push(`排版图型：[${layout.id}] ${layout.name || ''}`);
      enLines.push(`Layout Pattern: [${layout.id}] ${layout.name_en || layout.name || ''}`);
    }

    // 3. 主题色
    if (color) {
      zhLines.push(`主题色：[${color.id}] ${color.name_zh || ''} (${color.name_en || ''})`);
      enLines.push(`Theme Color: [${color.id}] ${color.name_en || ''}`);
    }

    // 4. 影调与氛围
    if (tone) {
      zhLines.push(`画面影调：${tone.name_zh || ''}（${tone.desc_zh || ''}）`);
      enLines.push(`Lighting/Tone: ${tone.name_en || ''} (${tone.desc_en || ''})`);
    }

    // 5. 情绪
    if (mood) {
      zhLines.push(`情绪氛围：${mood}`);
      enLines.push(`Mood: ${mood}`);
    }

    // 6. 主题事件 (严格忠实原意)
    zhLines.push(`主题内容：${theme}`);
    enLines.push(`Subject/Theme: ${theme}`);

    // 7. 画幅比例
    if (aspectRatio) {
      zhLines.push(`画幅比例：--ar ${aspectRatio}`);
      enLines.push(`Aspect Ratio: --ar ${aspectRatio}`);
    }

    // 8. 模式约束
    if (isTextMode) {
      zhLines.push(`构图要求：图文排版模式，请合理预留文字排版区域，标题层级清晰，文字与插画自然交融。`);
      enLines.push(`Composition: Editorial layout with integrated text, balanced negative space, clean typography hierarchy.`);
    } else {
      zhLines.push(`构图要求：纯图插画模式，画面无多余文字标注，视觉焦点明确。`);
      enLines.push(`Composition: Pure illustration, no arbitrary text overlays, strong visual focus.`);
    }

    return {
      zh: zhLines.join('\n'),
      en: enLines.join('\n')
    };
  },

  /**
   * 组装跨媒介双风格融合提示词 (Style Fusion)
   * 注入微缩摄影视角与绝对不可删改的共存契约段落
   */
  buildFusionPrompt({ roleStyle, sceneStyle, theme, mood, color, aspectRatio }) {
    if (!theme) return { zh: '', en: '' };

    const roleZh = roleStyle 
      ? `#${roleStyle.number} ${roleStyle.generation_name}。参考作者/风格名称：${roleStyle.reference}。核心风格特征：${roleStyle.traits}`
      : '手绘涂鸦';
    const roleEn = roleStyle 
      ? `#${roleStyle.number} ${roleStyle.generation_name}. Reference author/style: ${roleStyle.reference}. Core style traits: ${roleStyle.traits_en || roleStyle.traits}`
      : 'Hand-drawn Doodle';

    const sceneZh = sceneStyle 
      ? (sceneStyle.number ? `#${sceneStyle.number} ${sceneStyle.generation_name}。参考作者/风格名称：${sceneStyle.reference}。核心风格特征：${sceneStyle.traits}` : sceneStyle.name || '写实摄影')
      : '写实';
    const sceneEn = sceneStyle 
      ? (sceneStyle.number ? `#${sceneStyle.number} ${sceneStyle.generation_name}. Reference author/style: ${sceneStyle.reference}. Core style traits: ${sceneStyle.traits_en || sceneStyle.traits}` : sceneStyle.name_en || 'Realistic photography')
      : 'Realistic photography';

    const moodStr = mood || '紧张';
    const colorStr = color ? `${color.id} · ${color.name_zh || ''} (${color.name_en || ''})` : '';
    const arStr = aspectRatio || '3:4';

    // 中文标准融合段落 (逐字逐句严密遵循契约)
    const zh = `生成一幅“角色视觉语言 × 场景视觉语言”共存的跨媒介融合画面。缩微摄影，角色尺寸异常小，场景保持正常尺寸。
- 【角色视觉语言】：${roleZh}
- 【场景视觉语言】：${sceneZh}
- 【主题】：${theme}
- 【情绪】：${moodStr}
${colorStr ? `- 【主题色】：${colorStr}\n` : ''}- 【画幅比例】：${arStr}

缩微摄影，角色尺寸异常小，场景保持正常尺寸。
画面中必须同时存在两套清晰可辨的视觉语言。
不要把两者平均磨成普通的混合风格插画。
角色部分使用【角色视觉语言】表现，场景部分使用【场景视觉语言】表现。这里的“场景”包括环境空间、地形、建筑、植物、天空、水面、天气、地面、道具以及整体空间氛围。
【角色视觉语言】与【场景视觉语言】都必须忠实保留各自的核心特征，包括但不限于：造型逻辑、比例系统、线条方式、笔触特征、体块组织、几何倾向、材质表达、表面肌理、色彩体系、明暗方式、细节密度、空间处理方式、平面化或立体化程度以及各自独有的媒介感。不要额外强行加入与原风格无关的统一化修饰。
两种视觉语言必须保持明显差异，但共享同一个空间、光源、色温、天气、空气、构图和叙事时刻。
视觉统一应通过遮挡关系、接触关系、投影关系、地面关系、前后空间关系、局部反光、环境综合色和空气透视来完成，而不是把两种视觉语言磨成同一种质感。
角色必须真正存在于场景中，与场景形成自然互动，不能像贴纸一样浮在画面上。角色与场景之间需要有清楚可信的接触、站立、受光、投影、遮挡和空间关系。重点不是“一个角色站在另一个风格的背景前”，而是让角色真正进入并生活在这个场景世界中。
画面必须围绕【主题】形成一个明确的叙事瞬间，优先保证“谁、在哪里、正在做什么”清楚可读。不要为了展示风格而加入大量与主题无关的装饰元素。
如果画面中存在明显动作，如跑、跳、扑、拉、推、攀爬、追逐、搏斗、搬运或其他动态行为，需要保证发力点、重心、支撑关系、接触位置、受力方向、物体运动方向、遮挡和透视合理，动作逻辑优先于单纯夸张效果。
不要生硬拼贴，不要左右分栏，不要上下分区，不要贴纸叠加，不要主体悬浮，不要错误遮挡，不要不同光源互相冲突，不要让角色风格被完全同化成场景风格，也不要让场景风格被完全同化成角色风格。
最终效果应呈现：
- 缩微摄影比例，角色尺寸微小而场景保持正常尺寸
- 两种不同视觉语言自然存在于同一个世界中
- 角色风格与场景风格差异清晰
- 空间与光线逻辑统一
- 角色与场景互动自然
- 主题事件明确可读`;

    // 英文标准融合段落
    const en = `Generate a cross-media fusion artwork where "Character Visual Language × Scene Visual Language" coexist. Miniature photography, the character scale is exceptionally small, while the scene maintains normal scale.
- [Character Visual Language]: ${roleEn}
- [Scene Visual Language]: ${sceneEn}
- [Theme]: ${theme}
- [Mood]: ${moodStr}
${colorStr ? `- [Theme Color]: ${colorStr}\n` : ''}- [Aspect Ratio]: ${arStr}

Miniature photography, the character scale is exceptionally small, while the scene maintains normal scale.
Two clearly distinguishable visual languages must coexist in the image simultaneously.
Do NOT average or blend the two into a generic hybrid illustration.
The character elements must be rendered strictly in [Character Visual Language], while the scene elements must be rendered strictly in [Scene Visual Language]. Here, "scene" includes environmental space, terrain, architecture, vegetation, sky, water, weather, ground, props, and overall spatial ambiance.
Both [Character Visual Language] and [Scene Visual Language] must faithfully retain their respective core characteristics, including but not limited to: modeling logic, proportional systems, linework methods, brushstroke traits, volume organization, geometric tendencies, material expressions, surface textures, color systems, shading/lighting techniques, detail density, spatial treatment, degree of flatness vs. three-dimensionality, and their distinct tactile media sensations. Do NOT artificially force any uniform stylistic modifications irrelevant to each original style.
The two visual languages must maintain noticeable contrast, yet share the exact same space, light source, color temperature, weather, atmosphere, composition, and narrative moment.
Visual unity must be achieved through occlusions, physical contact, contact shadows, ground contact, fore/background depth, subtle bounce light, environmental ambient color, and aerial perspective, rather than blending the two visual languages into an identical material texture.
The character must truly exist and naturally interact within the scene world, rather than floating like a detached sticker. There must be credible physical contact, grounded posture, lighting, cast shadows, occlusions, and depth relationships between the character and the environment. The focus is NOT "a character simply standing in front of a different-styled background", but rather having the character truly inhabit and live within this environment.
The image must center around [Theme] to form a distinct narrative moment, prioritizing clarity of "who, where, and what they are doing". Do NOT introduce clutter or irrelevant decorative elements merely to exhibit the styles.
If dynamic actions are present (e.g., running, jumping, leaping, pulling, pushing, climbing, chasing, wrestling, carrying, or dynamic movements), ensure the center of gravity, support points, contact points, force vectors, motion trajectory, occlusion, and perspective are physically convincing; dynamic logic takes priority over superficial exaggeration.
Do NOT create awkward collages, do NOT split left-right or top-bottom columns, do NOT layer like stickers, do NOT let subjects float, avoid erroneous occlusions and conflicting light sources, do NOT assimilate the character style into the scene style, and do NOT assimilate the scene style into the character style.
The final result should achieve:
- Miniature photography scale contrast: character scale exceptionally small while scene maintains normal scale
- Two distinct visual languages coexisting harmoniously in the same world
- Clear differentiation between character style and scene style
- Unified spatial, perspective, and lighting logic
- Natural, believable physical interaction between character and scene
- Clear, legible thematic narrative event`;

    return { zh, en };
  }
};
