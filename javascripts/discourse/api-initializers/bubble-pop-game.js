import { apiInitializer } from "discourse/lib/api";

export default apiInitializer("1.0.0", (api) => {
  const enabled = settings.bubble_game_enabled;
  if (!enabled) return;

  const bubbleCount = settings.bubble_count || 30;
  const title = settings.bubble_title || "解压一下 🫧";

  let gameInserted = false;
  
  // 泡泡颜色列表
  const bubbleColors = ['pink', 'orange', 'yellow', 'green', 'blue', 'purple', 'cyan'];

  // 生成不重叠的随机位置
  function generateBubblePositions(count, containerWidth, containerHeight) {
    const positions = [];
    const minSize = 18;
    const maxSize = 32;
    const padding = 8; // 增加边距
    const maxAttempts = 100;

    for (let i = 0; i < count; i++) {
      let placed = false;
      let attempts = 0;
      
      while (!placed && attempts < maxAttempts) {
        const size = minSize + Math.random() * (maxSize - minSize);
        const x = padding + Math.random() * (containerWidth - size - padding * 2);
        const y = padding + Math.random() * (containerHeight - size - padding * 2);
        
        // 检查是否与已有泡泡重叠
        let overlapping = false;
        for (const pos of positions) {
          const dx = x + size/2 - (pos.x + pos.size/2);
          const dy = y + size/2 - (pos.y + pos.size/2);
          const distance = Math.sqrt(dx*dx + dy*dy);
          const minDistance = (size + pos.size) / 2 + 2; // 2px 间距
          
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
            animationDelay: Math.random() * 2,
            color: bubbleColors[Math.floor(Math.random() * bubbleColors.length)]
          });
          placed = true;
        }
        attempts++;
      }
      
      // 如果实在放不下，强制放置一个小泡泡
      if (!placed) {
        const size = minSize;
        positions.push({
          x: padding + Math.random() * (containerWidth - size - padding * 2),
          y: padding + Math.random() * (containerHeight - size - padding * 2),
          size,
          animationDelay: Math.random() * 2,
          color: bubbleColors[Math.floor(Math.random() * bubbleColors.length)]
        });
      }
    }
    
    return positions;
  }

  // 创建飞溅水滴效果
  function createSplashEffect(bubble, container) {
    const rect = bubble.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const centerX = rect.left - containerRect.left + rect.width / 2;
    const centerY = rect.top - containerRect.top + rect.height / 2;
    
    // 获取泡泡颜色
    const colorClass = Array.from(bubble.classList).find(c => c.startsWith('color-')) || 'color-blue';
    
    const splash = document.createElement("div");
    splash.className = "bubble-splash";
    splash.style.left = centerX + "px";
    splash.style.top = centerY + "px";
    
    // 创建 8-12 个水滴
    const dropCount = 8 + Math.floor(Math.random() * 5);
    for (let i = 0; i < dropCount; i++) {
      const drop = document.createElement("div");
      drop.className = "splash-drop " + colorClass;
      
      // 随机方向和距离
      const angle = (Math.PI * 2 * i) / dropCount + (Math.random() - 0.5) * 0.5;
      const distance = 20 + Math.random() * 30;
      const endX = Math.cos(angle) * distance;
      const endY = Math.sin(angle) * distance;
      
      // 随机大小
      const scale = 0.5 + Math.random() * 0.8;
      drop.style.transform = `scale(${scale})`;
      
      // 设置动画终点
      drop.style.setProperty("--end-x", endX + "px");
      drop.style.setProperty("--end-y", endY + "px");
      drop.animate([
        { transform: `translate(0, 0) scale(${scale})`, opacity: 1 },
        { transform: `translate(${endX}px, ${endY}px) scale(${scale * 0.3})`, opacity: 0 }
      ], {
        duration: 300 + Math.random() * 200,
        easing: "ease-out",
        fill: "forwards"
      });
      
      splash.appendChild(drop);
    }
    
    container.appendChild(splash);
    
    // 移除飞溅效果
    setTimeout(() => splash.remove(), 600);
  }

  // 播放更逼真的破裂音效
  function playPopSound() {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // 创建噪声
      const bufferSize = audioContext.sampleRate * 0.1;
      const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
      const data = buffer.getChannelData(0);
      
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.1));
      }
      
      const noise = audioContext.createBufferSource();
      noise.buffer = buffer;
      
      // 滤波器让声音更像泡泡破裂
      const filter = audioContext.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 800 + Math.random() * 400;
      filter.Q.value = 1;
      
      const gainNode = audioContext.createGain();
      gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
      
      noise.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      noise.start();
      noise.stop(audioContext.currentTime + 0.1);
    } catch (e) {
      // 静默处理
    }
  }

  function createBubbleGame() {
    const containerHeight = 140;
    
    const container = document.createElement("div");
    container.className = "bubble-pop-game";
    container.id = "bubble-pop-game";

    // 头部
    const header = document.createElement("div");
    header.className = "bubble-game-header";
    
    const titleEl = document.createElement("h4");
    titleEl.className = "bubble-game-title";
    titleEl.textContent = title;
    
    const resetBtn = document.createElement("button");
    resetBtn.className = "bubble-reset-btn";
    resetBtn.textContent = "重置";
    
    header.appendChild(titleEl);
    header.appendChild(resetBtn);
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

    // 延迟生成泡泡，等容器渲染后获取实际宽度
    setTimeout(() => {
      const actualWidth = bubbleContainer.offsetWidth || 200;
      initBubbles(bubbleContainer, container, actualWidth, containerHeight);
      
      // 绑定重置按钮
      resetBtn.onclick = () => resetGame(container, actualWidth, containerHeight);
    }, 50);

    return container;
  }

  function initBubbles(bubbleContainer, gameContainer, containerWidth, containerHeight) {
    // 清空现有泡泡
    bubbleContainer.innerHTML = '';
    
    // 生成泡泡
    const positions = generateBubblePositions(bubbleCount, containerWidth, containerHeight);
    positions.forEach((pos, index) => {
      const bubble = document.createElement("div");
      bubble.className = "bubble color-" + pos.color;
      bubble.style.left = pos.x + "px";
      bubble.style.top = pos.y + "px";
      bubble.style.width = pos.size + "px";
      bubble.style.height = pos.size + "px";
      bubble.style.animationDelay = pos.animationDelay + "s";
      bubble.dataset.index = index;
      
      bubble.onclick = () => popBubble(bubble, bubbleContainer, gameContainer);
      bubbleContainer.appendChild(bubble);
    });
  }

  function popBubble(bubble, bubbleContainer, gameContainer) {
    if (bubble.classList.contains("popped")) return;

    // 播放音效
    playPopSound();
    
    // 创建飞溅效果
    createSplashEffect(bubble, bubbleContainer);
    
    // 添加破裂动画
    bubble.classList.add("popped");
    
    // 更新进度
    updateProgress(gameContainer);
  }

  function updateProgress(container) {
    const popped = container.querySelectorAll(".bubble.popped").length;
    const percentage = (popped / bubbleCount) * 100;

    const fill = container.querySelector(".bubble-progress-fill");
    const text = container.querySelector(".bubble-progress-text");
    
    if (fill) fill.style.width = `${percentage}%`;
    if (text) text.textContent = `${popped} / ${bubbleCount}`;

    // 全部捏完
    if (popped === bubbleCount) {
      const progress = container.querySelector(".bubble-progress");
      if (progress && !container.querySelector(".bubble-complete")) {
        const complete = document.createElement("div");
        complete.className = "bubble-complete";
        complete.textContent = "🎉 全部捏完啦！感觉好解压~";
        progress.appendChild(complete);
      }
    }
  }

  function resetGame(container, containerWidth, containerHeight) {
    // 获取泡泡容器
    const bubbleContainer = container.querySelector(".bubble-container");
    if (bubbleContainer) {
      // 获取实际宽度
      const actualWidth = bubbleContainer.offsetWidth || containerWidth;
      initBubbles(bubbleContainer, container, actualWidth, containerHeight);
    }

    // 重置进度
    const fill = container.querySelector(".bubble-progress-fill");
    const text = container.querySelector(".bubble-progress-text");
    const complete = container.querySelector(".bubble-complete");
    
    if (fill) fill.style.width = "0%";
    if (text) text.textContent = `0 / ${bubbleCount}`;
    if (complete) complete.remove();
  }

  function insertGame() {
    if (gameInserted) return;
    
    const sidebar = document.querySelector(".sidebar-wrapper");
    if (!sidebar) return;

    const categoriesSection = sidebar.querySelector(".sidebar-section[data-section-name='categories']");
    
    if (categoriesSection) {
      const existingGame = document.getElementById("bubble-pop-game");
      if (existingGame) return;

      const game = createBubbleGame();
      categoriesSection.parentNode.insertBefore(game, categoriesSection.nextSibling);
      gameInserted = true;
    }
  }

  const observer = new MutationObserver(() => {
    if (!document.getElementById("bubble-pop-game")) {
      gameInserted = false;
      insertGame();
    }
  });

  api.onPageChange(() => {
    setTimeout(() => {
      insertGame();
      
      const sidebar = document.querySelector(".sidebar-wrapper");
      if (sidebar) {
        observer.observe(sidebar, { childList: true, subtree: true });
      }
    }, 500);
  });
});
