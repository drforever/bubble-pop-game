import { apiInitializer } from "discourse/lib/api";

export default apiInitializer("1.0.0", (api) => {
  const enabled = settings.bubble_game_enabled;
  if (!enabled) return;

  const bubbleCount = settings.bubble_count || 30;
  const title = settings.bubble_title || "解压一下 🫧";

  let gameInserted = false;
  let audioContext = null;
  let currentObserver = null;
  let audioSoundPool = new Set();
  const MAX_AUDIO_SOURCES = 12;

  // 泡泡颜色
  const bubbleColors = [
    "rose",
    "peach",
    "lemon",
    "mint",
    "sky",
    "lilac",
    "coral",
  ];

  // combo 状态
  let comboCount = 0;
  let comboTimer = null;
  const COMBO_TIMEOUT = 800; // ms 内连续点击算 combo

  function getAudioContext() {
    if (!audioContext) {
      try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        // 静默
      }
    }
    return audioContext;
  }

  // 生成不重叠的随机位置
  function generateBubblePositions(count, containerWidth, containerHeight) {
    const positions = [];
    const minSize = 20;
    const maxSize = 36;
    const padding = 6;
    const maxAttempts = 120;

    for (let i = 0; i < count; i++) {
      let placed = false;
      let attempts = 0;

      while (!placed && attempts < maxAttempts) {
        const size = minSize + Math.random() * (maxSize - minSize);
        const x =
          padding + Math.random() * (containerWidth - size - padding * 2);
        const y =
          padding + Math.random() * (containerHeight - size - padding * 2);

        let overlapping = false;
        for (const pos of positions) {
          const dx = x + size / 2 - (pos.x + pos.size / 2);
          const dy = y + size / 2 - (pos.y + pos.size / 2);
          const distance = Math.sqrt(dx * dx + dy * dy);
          const minDistance = (size + pos.size) / 2 + 3;

          if (distance < minDistance) {
            overlapping = true;
            break;
          }
        }

        if (!overlapping) {
          positions.push({
            x,
            y,
            size,
            animationDelay: Math.random() * 3,
            color: bubbleColors[Math.floor(Math.random() * bubbleColors.length)],
          });
          placed = true;
        }
        attempts++;
      }

      if (!placed) {
        const size = minSize;
        positions.push({
          x: padding + Math.random() * (containerWidth - size - padding * 2),
          y: padding + Math.random() * (containerHeight - size - padding * 2),
          size,
          animationDelay: Math.random() * 3,
          color: bubbleColors[Math.floor(Math.random() * bubbleColors.length)],
        });
      }
    }

    return positions;
  }

  // 飞溅水滴
  function createSplashEffect(bubble, container) {
    const rect = bubble.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const centerX = rect.left - containerRect.left + rect.width / 2;
    const centerY = rect.top - containerRect.top + rect.height / 2;

    const colorClass =
      Array.from(bubble.classList).find((c) => c.startsWith("color-")) ||
      "color-sky";

    const splash = document.createElement("div");
    splash.className = "bubble-splash";
    splash.style.left = centerX + "px";
    splash.style.top = centerY + "px";

    const dropCount = 6 + Math.floor(Math.random() * 6);
    for (let i = 0; i < dropCount; i++) {
      const drop = document.createElement("div");
      drop.className = "splash-drop " + colorClass;

      const angle =
        (Math.PI * 2 * i) / dropCount + (Math.random() - 0.5) * 0.5;
      const distance = 15 + Math.random() * 25;
      const endX = Math.cos(angle) * distance;
      const endY = Math.sin(angle) * distance;

      const scale = 0.4 + Math.random() * 0.7;
      drop.style.transform = `scale(${scale})`;

      drop.animate(
        [
          { transform: `translate(0, 0) scale(${scale})`, opacity: 1 },
          {
            transform: `translate(${endX}px, ${endY}px) scale(${scale * 0.2})`,
            opacity: 0,
          },
        ],
        {
          duration: 200 + Math.random() * 150,
          easing: "ease-out",
          fill: "forwards",
        }
      );

      splash.appendChild(drop);
    }

    container.appendChild(splash);
    setTimeout(() => splash.remove(), 400);
  }

  // combo 文字飘出
  function showComboText(bubble, container, combo) {
    if (combo < 2) return;

    const rect = bubble.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const x = rect.left - containerRect.left + rect.width / 2;
    const y = rect.top - containerRect.top;

    const el = document.createElement("div");
    el.className = "bubble-combo-text";
    if (combo >= 10) {
      el.classList.add("combo-legendary");
    } else if (combo >= 5) {
      el.classList.add("combo-great");
    }
    el.textContent =
      combo >= 10
        ? `🔥 ${combo}x COMBO!`
        : combo >= 5
          ? `⚡ ${combo}x Combo!`
          : `${combo}x`;
    el.style.left = x + "px";
    el.style.top = y + "px";

    container.appendChild(el);
    setTimeout(() => el.remove(), 700);
  }

  // 音效 - 直接合成，无缓冲，极速响应
  function playPopSound(combo) {
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      // 检查音源池大小
      if (audioSoundPool.size >= MAX_AUDIO_SOURCES) return;

      const duration = 0.05;
      const now = ctx.currentTime;

      // 创建振荡器
      const osc = ctx.createOscillator();
      osc.type = "sine";
      const freq = 600 + Math.min(combo, 12) * 120 + Math.random() * 120;
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(150, now + duration);

      // 增益包络
      const gain = ctx.createGain();
      const vol = Math.min(0.08 + combo * 0.006, 0.2);
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      // 连接
      osc.connect(gain);
      gain.connect(ctx.destination);

      // 播放
      osc.start(now);
      osc.stop(now + duration);

      // 添加到池，并在停止后自动移除
      audioSoundPool.add(osc);
      osc.onended = () => audioSoundPool.delete(osc);
    } catch (e) {
      // 静默
    }
  }

  function createBubbleGame() {
    const containerHeight = 150;

    const container = document.createElement("div");
    container.className = "bubble-pop-game";
    container.id = "bubble-pop-game";

    // 头部
    const header = document.createElement("div");
    header.className = "bubble-game-header";

    const titleEl = document.createElement("h4");
    titleEl.className = "bubble-game-title";
    titleEl.textContent = title;

    const headerRight = document.createElement("div");
    headerRight.className = "bubble-game-header-right";

    const comboEl = document.createElement("span");
    comboEl.className = "bubble-combo-badge hidden";
    comboEl.textContent = "";

    const resetBtn = document.createElement("button");
    resetBtn.className = "bubble-reset-btn";
    resetBtn.textContent = "↻";
    resetBtn.title = "重置";

    headerRight.appendChild(comboEl);
    headerRight.appendChild(resetBtn);
    header.appendChild(titleEl);
    header.appendChild(headerRight);
    container.appendChild(header);

    // 泡泡容器
    const bubbleContainer = document.createElement("div");
    bubbleContainer.className = "bubble-container";
    bubbleContainer.style.height = containerHeight + "px";
    container.appendChild(bubbleContainer);

    // 进度条
    const progress = document.createElement("div");
    progress.className = "bubble-progress";
    progress.innerHTML = `
      <div class="bubble-progress-bar">
        <div class="bubble-progress-fill" style="width: 0%"></div>
      </div>
      <span class="bubble-progress-text">0 / ${bubbleCount}</span>
    `;
    container.appendChild(progress);

    // 等容器渲染后再生成泡泡
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const actualWidth = bubbleContainer.offsetWidth || 200;
        initBubbles(bubbleContainer, container, actualWidth, containerHeight);

        resetBtn.onclick = () => {
          comboCount = 0;
          clearTimeout(comboTimer);
          updateComboBadge(container);
          resetGame(container, actualWidth, containerHeight);
        };
      });
    });

    return container;
  }

  function initBubbles(
    bubbleContainer,
    gameContainer,
    containerWidth,
    containerHeight
  ) {
    bubbleContainer.innerHTML = "";

    const positions = generateBubblePositions(
      bubbleCount,
      containerWidth,
      containerHeight
    );
    positions.forEach((pos, index) => {
      const bubble = document.createElement("div");
      bubble.className = "bubble color-" + pos.color;
      bubble.style.left = pos.x + "px";
      bubble.style.top = pos.y + "px";
      bubble.style.width = pos.size + "px";
      bubble.style.height = pos.size + "px";
      bubble.style.animationDelay = pos.animationDelay + "s";
      bubble.dataset.index = index;

      // 用 pointerdown 而不是 click，响应更快（快 50-100ms）
      bubble.addEventListener("pointerdown", () => {
        popBubble(bubble, bubbleContainer, gameContainer);
      }, { passive: true });
      bubbleContainer.appendChild(bubble);
    });
  }

  function popBubble(bubble, bubbleContainer, gameContainer) {
    if (bubble.classList.contains("popped")) return;

    // combo 计算（快速）
    clearTimeout(comboTimer);
    comboCount++;
    comboTimer = setTimeout(() => {
      comboCount = 0;
      updateComboBadge(gameContainer);
    }, COMBO_TIMEOUT);

    // 立即标记为 popped，触发破裂动画
    bubble.classList.add("popped");

    // 音效（无阻塞）
    playPopSound(comboCount);

    // 效果延迟到下一帧，不阻塞主线程
    requestAnimationFrame(() => {
      createSplashEffect(bubble, bubbleContainer);
      showComboText(bubble, bubbleContainer, comboCount);
      updateComboBadge(gameContainer);
      updateProgress(gameContainer);
    });
  }

  function updateComboBadge(container) {
    const badge = container.querySelector(".bubble-combo-badge");
    if (!badge) return;

    if (comboCount >= 2) {
      badge.classList.remove("hidden");
      badge.textContent = `${comboCount}x`;
      if (comboCount >= 10) {
        badge.className = "bubble-combo-badge combo-legendary";
      } else if (comboCount >= 5) {
        badge.className = "bubble-combo-badge combo-great";
      } else {
        badge.className = "bubble-combo-badge";
      }
    } else {
      badge.classList.add("hidden");
    }
  }

  function updateProgress(container) {
    const popped = container.querySelectorAll(".bubble.popped").length;
    const percentage = (popped / bubbleCount) * 100;

    const fill = container.querySelector(".bubble-progress-fill");
    const text = container.querySelector(".bubble-progress-text");

    if (fill) fill.style.width = `${percentage}%`;
    if (text) text.textContent = `${popped} / ${bubbleCount}`;

    if (popped === bubbleCount) {
      const progress = container.querySelector(".bubble-progress");
      if (progress && !container.querySelector(".bubble-complete")) {
        const complete = document.createElement("div");
        complete.className = "bubble-complete";
        
        // 随机选择一个完成文案
        const completionMessages = [
          "🎉 全部捏完啦！",
          "✨ 疗愈成功！压力消散~",
          "🫧 泡泡全消灭！",
          "😌 心情舒畅！再来一遍？",
          "🎊 完美无缺！",
          "💆 放松一下，感觉不错~",
          "🌟 今天的解压达成！",
          "✅ 全部搞定！"
        ];
        complete.textContent = completionMessages[Math.floor(Math.random() * completionMessages.length)];
        progress.appendChild(complete);

        // 撒花效果
        createConfetti(container);
      }
    }
  }

  // 完成时撒花
  function createConfetti(container) {
    const confettiContainer = document.createElement("div");
    confettiContainer.className = "bubble-confetti";

    const colors = [
      "#ff6b8a",
      "#ffa07a",
      "#ffd700",
      "#7ecf8b",
      "#6bb5ff",
      "#b388ff",
      "#ff8a80",
    ];
    const containerWidth = container.offsetWidth;

    for (let i = 0; i < 30; i++) {
      const confetti = document.createElement("div");
      confetti.className = "confetti-piece";
      confetti.style.left = Math.random() * containerWidth + "px";
      confetti.style.backgroundColor =
        colors[Math.floor(Math.random() * colors.length)];
      confetti.style.animationDelay = Math.random() * 0.5 + "s";
      confetti.style.animationDuration = 1 + Math.random() * 1 + "s";
      confettiContainer.appendChild(confetti);
    }

    container.appendChild(confettiContainer);
    setTimeout(() => confettiContainer.remove(), 2500);
  }

  function resetGame(container, containerWidth, containerHeight) {
    const bubbleContainer = container.querySelector(".bubble-container");
    if (bubbleContainer) {
      const actualWidth = bubbleContainer.offsetWidth || containerWidth;
      initBubbles(bubbleContainer, container, actualWidth, containerHeight);
    }

    const fill = container.querySelector(".bubble-progress-fill");
    const text = container.querySelector(".bubble-progress-text");
    const complete = container.querySelector(".bubble-complete");
    const confetti = container.querySelector(".bubble-confetti");

    if (fill) fill.style.width = "0%";
    if (text) text.textContent = `0 / ${bubbleCount}`;
    if (complete) complete.remove();
    if (confetti) confetti.remove();
  }

  function isAdminRoute() {
    return /^\/admin(\/|$)/.test(window.location.pathname);
  }

  function removeGame() {
    const existingGame = document.getElementById("bubble-pop-game");
    if (existingGame) {
      existingGame.remove();
      gameInserted = false;
    }
  }

  function insertGame() {
    // 管理员后台不显示游戏
    if (isAdminRoute()) {
      removeGame();
      return;
    }

    if (gameInserted) return;

    const sidebar = document.querySelector(".sidebar-wrapper");
    if (!sidebar) return;

    const existingGame = document.getElementById("bubble-pop-game");
    if (existingGame) return;

    const categoriesSection = sidebar.querySelector(
      ".sidebar-section[data-section-name='categories']"
    );
    const game = createBubbleGame();

    if (categoriesSection) {
      categoriesSection.parentNode.insertBefore(
        game,
        categoriesSection.nextSibling
      );
    } else {
      // 降级：插到侧边栏末尾
      sidebar.appendChild(game);
    }

    gameInserted = true;
  }

  function disconnectObserver() {
    if (currentObserver) {
      currentObserver.disconnect();
      currentObserver = null;
    }
  }

  api.onPageChange(() => {
    setTimeout(() => {
      if (!document.getElementById("bubble-pop-game")) {
        gameInserted = false;
      }
      insertGame();

      disconnectObserver();
      const sidebar = document.querySelector(".sidebar-wrapper");
      if (sidebar) {
        currentObserver = new MutationObserver(() => {
          if (!document.getElementById("bubble-pop-game")) {
            gameInserted = false;
            insertGame();
          }
        });
        currentObserver.observe(sidebar, { childList: true, subtree: true });
      }
    }, 300);
  });

  // 清理
  api.cleanupStream(() => {
    disconnectObserver();
    if (audioContext) {
      audioContext.close().catch(() => {});
      audioContext = null;
    }
  });
});
