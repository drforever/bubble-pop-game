import { apiInitializer } from "discourse/lib/api";

export default apiInitializer("1.0.0", (api) => {
  const enabled = settings.bubble_game_enabled;
  if (!enabled) return;

  const rows = settings.bubble_rows || 5;
  const cols = settings.bubble_cols || 8;
  const title = settings.bubble_title || "解压一下 🫧";

  let gameInserted = false;

  function createBubbleGame() {
    const totalBubbles = rows * cols;
    
    // 创建容器
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
    resetBtn.onclick = () => resetGame(container);
    
    header.appendChild(titleEl);
    header.appendChild(resetBtn);
    container.appendChild(header);

    // 泡泡网格
    const grid = document.createElement("div");
    grid.className = "bubble-grid";
    grid.style.gridTemplateColumns = `repeat(${cols}, 24px)`;

    for (let i = 0; i < totalBubbles; i++) {
      const bubble = document.createElement("div");
      bubble.className = "bubble intact";
      bubble.dataset.index = i;
      bubble.onclick = () => popBubble(bubble, container);
      grid.appendChild(bubble);
    }
    container.appendChild(grid);

    // 进度条
    const progress = document.createElement("div");
    progress.className = "bubble-progress";
    progress.innerHTML = `
      <div class="bubble-progress-bar">
        <div class="bubble-progress-fill" style="width: 0%"></div>
      </div>
      <span class="bubble-progress-text">0 / ${totalBubbles}</span>
    `;
    container.appendChild(progress);

    return container;
  }

  function popBubble(bubble, container) {
    if (bubble.classList.contains("popped")) return;

    // 播放捏泡泡动画
    bubble.classList.add("popping");
    
    // 播放音效（可选，使用 Web Audio API 生成简单音效）
    playPopSound();

    setTimeout(() => {
      bubble.classList.remove("intact", "popping");
      bubble.classList.add("popped");
      updateProgress(container);
    }, 150);
  }

  function playPopSound() {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 0.1);

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
    } catch (e) {
      // 音效播放失败时静默处理
    }
  }

  function updateProgress(container) {
    const totalBubbles = rows * cols;
    const popped = container.querySelectorAll(".bubble.popped").length;
    const percentage = (popped / totalBubbles) * 100;

    const fill = container.querySelector(".bubble-progress-fill");
    const text = container.querySelector(".bubble-progress-text");
    
    if (fill) fill.style.width = `${percentage}%`;
    if (text) text.textContent = `${popped} / ${totalBubbles}`;

    // 全部捏完
    if (popped === totalBubbles) {
      const progress = container.querySelector(".bubble-progress");
      if (progress && !container.querySelector(".bubble-complete")) {
        const complete = document.createElement("div");
        complete.className = "bubble-complete";
        complete.textContent = "🎉 全部捏完啦！休息一下吧~";
        progress.appendChild(complete);
      }
    }
  }

  function resetGame(container) {
    const bubbles = container.querySelectorAll(".bubble");
    bubbles.forEach((bubble) => {
      bubble.classList.remove("popped");
      bubble.classList.add("intact");
    });

    const fill = container.querySelector(".bubble-progress-fill");
    const text = container.querySelector(".bubble-progress-text");
    const complete = container.querySelector(".bubble-complete");
    
    if (fill) fill.style.width = "0%";
    if (text) text.textContent = `0 / ${rows * cols}`;
    if (complete) complete.remove();
  }

  function insertGame() {
    if (gameInserted) return;
    
    // 查找侧边栏中"所有类别"下方的位置
    const sidebar = document.querySelector(".sidebar-wrapper");
    if (!sidebar) return;

    // 尝试找到类别部分
    const categoriesSection = sidebar.querySelector(".sidebar-section[data-section-name='categories']");
    
    if (categoriesSection) {
      // 在类别部分后面插入游戏
      const existingGame = document.getElementById("bubble-pop-game");
      if (existingGame) return;

      const game = createBubbleGame();
      categoriesSection.parentNode.insertBefore(game, categoriesSection.nextSibling);
      gameInserted = true;
    }
  }

  // 使用 MutationObserver 监听 DOM 变化
  const observer = new MutationObserver(() => {
    if (!document.getElementById("bubble-pop-game")) {
      gameInserted = false;
      insertGame();
    }
  });

  // 页面加载完成后开始监听
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
