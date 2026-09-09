document.addEventListener('DOMContentLoaded', () => {
  const chatForm = document.getElementById('chatForm');
  const userInput = document.getElementById('userInput');
  const chatMessages = document.getElementById('chatMessages');
  const headerStatus = document.getElementById('headerStatus');
  const headerAvatar = document.getElementById('headerAvatar');
  const moodChips = document.querySelectorAll('.mood-chip');
  const newChatBtn = document.getElementById('newChatBtn');
  const moodLogBtn = document.getElementById('moodLogBtn');
  const dynamicChatList = document.getElementById('dynamicChatList');
  const clearAllChatsBtn = document.getElementById('clearAllChatsBtn');

  // --- LOCAL STORAGE STATE MANAGEMENT ---
  let chats = JSON.parse(localStorage.getItem('aura_chats')) || [];
  let currentChatId = localStorage.getItem('aura_current_chat_id') || null;
  let userName = localStorage.getItem('aura_user_nickname') || null;
  let conversationState = null;

  // Initialize Chat History on Load
  if (chats.length === 0) {
    createNewChat(false);
  } else if (!currentChatId || !chats.find(c => c.id === currentChatId)) {
    currentChatId = chats[0].id;
  }

  // --- RULE DATABASE ---
  const rules = [
    // 1. Mood Log Summary Rule (FIXED)
    {
      id: 'mood_log_intent',
      pattern: /(mood\s*log|show\s*me\s*my\s*mood\s*log|view\s*mood\s*log|check\s*mood\s*log)/i,
      handler: () => {
        const totalSessions = chats.length;
        const totalMessages = chats.reduce((acc, chat) => acc + chat.messages.length, 0);

        return {
          badgeText: 'Mood Log Summary',
          badgeClass: 'level-calm',
          statusText: 'Reviewing your check-in journal...',
          avatar: '📊',
          response: `Here is your current **Mood Log Summary**${userName ? `, ${userName}` : ''}:`,
          careSteps: [
            `<strong>Total Check-In Sessions:</strong> ${totalSessions} active conversation(s)`,
            `<strong>Journal Entries Recorded:</strong> ${totalMessages} total message(s)`,
            `<strong>Current Nickname:</strong> ${userName || 'Not set (say "call me [Name]")'}`,
            `<strong>Daily Goal:</strong> Take 5 minutes to pause, reflect, and breathe today. 🌿`
          ]
        };
      }
    },

    // 2. Custom Nickname Rule
    {
      id: 'set_nickname',
      pattern: /call\s*me\s+(.+)/i,
      handler: (text, match) => {
        const name = match[1].trim();
        userName = name;
        localStorage.setItem('aura_user_nickname', userName);
        return {
          badgeText: 'Profile Updated',
          badgeClass: 'level-calm',
          statusText: `Speaking with ${userName}...`,
          avatar: '🤝',
          response: `Ok ${userName}, I will call you ${userName} from now on!`
        };
      }
    },

    // 3. Identity Rule
    {
      id: 'bot_identity',
      pattern: /(what\s*is\s*your\s*name|who\s*are\s*you|what\s*should\s*i\s*call\s*you)/i,
      handler: () => ({
        badgeText: 'Info: Identity',
        badgeClass: 'level-calm',
        statusText: 'Here to listen & support',
        avatar: '🌿',
        response: `My name is **Aura**! I am your personal emotional support companion. I'm here to listen, help you process stress, or offer motivation whenever you need a boost${userName ? `, ${userName}` : ''}.`
      })
    },

    // 4. Out of Scope Rule
    {
      id: 'out_of_scope',
      pattern: /(quadratic|equation|python|code|math|calculate|history|who\s*is\s*president|capital\s*of|formula|physics)/i,
      handler: () => ({
        badgeText: 'Notice: Out of Scope',
        badgeClass: 'level-high',
        statusText: 'Focusing on emotional well-being...',
        avatar: '🔒',
        response: "I'm sorry, but I am specifically designed as an **emotional companion** for mood tracking, stress support, and motivation. I can't help with technical questions or trivia. How are you feeling emotionally right now?"
      })
    },

    // 5. Sleep Restlessness Rule
    {
      id: 'sleep_intent',
      pattern: /(can'?t\s*sleep|not\s*getting\s*sleep|trouble\s*sleeping|insomnia|sleeping\s*properly|hard\s*to\s*sleep|stay\s*awake)/i,
      handler: () => ({
        badgeText: 'State: Sleep Restlessness',
        badgeClass: 'level-medium',
        statusText: 'Guiding night relaxation...',
        avatar: '🌙',
        response: `${userName ? `Hey ${userName}, ` : ''}not being able to sleep properly can make everything feel harder. When your mind is racing, focus on lowering core arousal rather than forcing sleep.`,
        careSteps: [
          '<strong>1. 20-Minute Rule:</strong> If lying awake for >20 mins, get out of bed and do a low-light activity until sleepy.',
          '<strong>2. Brain Dump:</strong> Write down lingering tasks on paper to clear your mental queue.',
          '<strong>3. Screen Freeze:</strong> Turn off blue light screens 30-60 mins before sleep.'
        ]
      })
    },

    // 6. Anxiety & Panic Rule
    {
      id: 'anxiety_intent',
      pattern: /(anxious|anxiety|panic|panicking|nervous|heart\s*racing|feeling\s*uneasy)/i,
      handler: () => ({
        badgeText: 'State: Anxiety Detected',
        badgeClass: 'level-high',
        statusText: 'Providing grounding remedies...',
        avatar: '🌬️',
        response: `${userName ? `${userName}, ` : ''}anxiety can feel overwhelming in the body. Remember that you are safe right now, and this physical sensation will pass.`,
        careSteps: [
          '<strong>5-4-3-2-1 Technique:</strong> Name 5 things you see, 4 you touch, 3 you hear, 2 you smell, and 1 slow breath.',
          '<strong>Cold Water Reset:</strong> Splash cold water on your face to slow your heart rate.',
          '<strong>4-7-8 Breathing:</strong> Inhale for 4s, hold for 7s, exhale for 8s.'
        ]
      })
    },

    // 7. Active Stress Intent Rule
    {
      id: 'stress_intent',
      pattern: /(i\s*am\s*stressed|feeling\s*stressed|so\s*stressed|stressed\s*out|i\s*feel\s*stressed)/i,
      handler: () => {
        conversationState = 'awaiting_stress_reason';
        return {
          badgeText: 'Stress Detected: Active',
          badgeClass: 'level-high',
          statusText: 'Exploring stress sources...',
          avatar: '🌬️',
          response: `I hear you${userName ? `, ${userName}` : ''}, and it's completely okay to feel stressed. What is the main reason for your stress right now? (e.g., work, studies, or personal life?)`,
          careSteps: [
            '<strong>Pause:</strong> Take 3 slow breaths while you think about it.',
            '<strong>Reflect:</strong> Identifying the cause is the first step.'
          ]
        };
      }
    },

    // 8. Need Motivation Intent Rule
    {
      id: 'motivation_intent',
      pattern: /(need\s*motivation|unmotivated|procrastinating|give\s*up|can'?t\s*focus)/i,
      handler: () => ({
        badgeText: 'State: Seeking Motivation',
        badgeClass: 'level-low',
        statusText: 'Energizing & motivating you...',
        avatar: '🔥',
        response: `You don't need a huge wave of energy to start${userName ? `, ${userName}` : ''}—you just need 2 minutes of focus. Pick one tiny step and begin!`,
        careSteps: [
          '<strong>2-Minute Rule:</strong> Work for 120 seconds without stopping.',
          '<strong>Micro Goal:</strong> Clear just one item off your list.'
        ]
      })
    },

    // 9. Greeting Rule
    {
      id: 'greeting',
      pattern: /(hi|hello|hey|good\s*morning|good\s*evening)/i,
      handler: () => ({
        badgeText: 'State: Welcome',
        badgeClass: 'level-calm',
        statusText: 'Ready for check-in...',
        avatar: '🌿',
        response: `Hello${userName ? ` ${userName}` : ''}! I'm glad you checked in today. How has your day been treating you?`
      })
    },

    // 10. Farewell Rule
    {
      id: 'goodbye',
      pattern: /(goodbye|good\s*bye|bye|bye\s*bye|see\s*you|cya|have\s*a\s*good\s*day|have\s*a\s*good\s*night)/i,
      handler: () => ({
        badgeText: 'State: Session Complete',
        badgeClass: 'level-calm',
        statusText: 'Wishing you well...',
        avatar: '👋',
        response: `Goodbye for now${userName ? `, ${userName}` : ''}! Remember to take things one step at a time. Have a peaceful day ahead! 🌿`,
        careSteps: [
          '<strong>Final thought:</strong> Take a deep breath before you log off.',
          '<strong>Self-care reminder:</strong> Drink a glass of water.'
        ]
      })
    },


    // 1. Daily Routine Rule
    {
      id: 'daily_routine_intent',
      pattern: /(daily\s*routine|routine\s*plan|schedule\s*my\s*day|day\s*plan)/i,
      handler: () => ({
        badgeText: 'Plan: Daily Structure',
        badgeClass: 'level-calm',
        statusText: 'Setting up a balanced routine...',
        avatar: '📅',
        response: `Having a steady routine creates peace of mind${userName ? `, ${userName}` : ''}. Here is a simple, grounded daily structure you can follow:`,
        careSteps: [
          '<strong>Morning (Anchor):</strong> Drink water, get 10 mins of sunlight, and state 1 priority for today.',
          '<strong>Afternoon (Focus & Flow):</strong> Work in 45-minute blocks with short movement breaks.',
          '<strong>Evening (Unwind):</strong> Dim bright lights, put screens away 1 hour before sleep, and reflect on 1 positive moment.'
        ]
      })
    },

    // 2 & 4. Happy / Feeling Calm Rule
    {
      id: 'happy_calm_intent',
      pattern: /(i\s*am\s*happy|feeling\s*happy|feeling\s*calm|i\s*feel\s*calm|feeling\s*peaceful|good\s*const moodd)/i,
      handler: () => ({
        badgeText: 'State: Happy & Peaceful',
        badgeClass: 'level-calm',
        statusText: 'Sharing the positive light...',
        avatar: '😊',
        response: `Nice! A happy and calm mind is always a wonder to cultivate${userName ? `, ${userName}` : ''}. Savor this feeling—it brings real balance to your overall well-being.`,
        careSteps: [
          '<strong>Anchor the Moment:</strong> Take a quiet breath and notice how peace feels in your body.',
          '<strong>Keep the Momentum:</strong> Do something kind for yourself or someone else today.'
        ]
      })
    },

    // 3. Childhood Trauma Support Rule
    {
      id: 'childhood_trauma_intent',
      pattern: /(childhood|trauma|past\s*hurt|childhood\s*trauma|past\s*wounds)/i,
      handler: () => ({
        badgeText: 'State: Healing & Reflection',
        badgeClass: 'level-medium',
        statusText: 'Holding a gentle space...',
        avatar: '🩹',
        response: `Thank you for sharing that with me${userName ? `, ${userName}` : ''}. Unpacking childhood trauma is deep, delicate work. What you experienced in the past wasn't your fault, and learning to navigate it takes genuine courage.`,
        careSteps: [
          '<strong>Self-Compassion:</strong> Remind yourself that you are safe in the present moment.',
          '<strong>Gentle Grounding:</strong> Place a hand over your heart and take 3 slow, deep breaths.',
          '<strong>Professional Care:</strong> Consider working with a trauma-informed therapist for long-term healing.'
        ]
      })
    },

    // 5. High Distress & Crisis Safety Rule (Suicide, Pressure, Harassment)
    {
      id: 'distress_crisis_intent',
      pattern: /(suicide|kill\s*myself|end\s*my\s*life|harassment|harassed|extreme\s*pressure|can'?t\s*take\s*it\s*anymore)/i,
      handler: () => ({
        badgeText: 'CRISIS SUPPORT & SAFETY',
        badgeClass: 'level-high',
        statusText: 'Connecting you with immediate safety...',
        avatar: '🆘',
        response: `I hear how deeply overwhelmed you feel right now${userName ? `, ${userName}` : ''}, but please know **you are not alone** and support is available immediately. Please reach out to someone who can help keep you safe.`,
        careSteps: [
          '<strong>National Suicide Helpline (India):</strong> Call <strong>9152987821</strong> (iCall) or <strong>14416</strong> (Tele-MANAS).',
          '<strong>US/International Helpline:</strong> Call or text <strong>988</strong> (Crisis Lifeline).',
          '<strong>Immediate Safety:</strong> Speak directly to a trusted friend, family member, or healthcare professional right now.'
        ]
      })
    },

    // 6. Discrimination (Caste, Creed, Religion, Bias) Rule
    {
      id: 'discrimination_intent',
      pattern: /(caste|creed|religion|discrimination|discriminated|racism|bias|prejudice)/i,
      handler: () => ({
        badgeText: 'State: Identity & Fairness',
        badgeClass: 'level-high',
        statusText: 'Offering safe emotional support...',
        avatar: '🤝',
        response: `Facing discrimination based on caste, religion, or identity is deeply unfair and exhausting${userName ? `, ${userName}` : ''}. Your worth is intrinsic, and no external prejudice defines who you are.`,
        careSteps: [
          '<strong>Validate Feelings:</strong> Anger or sadness in the face of injustice is completely valid.',
          '<strong>Safe Community:</strong> Surround yourself with allies and safe spaces that honor your dignity.',
          '<strong>Document & Protect:</strong> Protect your mental energy and seek legal or institutional support if needed.'
        ]
      })
    },

    // 7. Social / Family Comparison Rule (Slinging comparison with siblings/neighbors)
    {
      id: 'comparison_intent',
      pattern: /(better\s*than\s*me|comparing\s*me|comparison|sibling\s*is\s*better|brother\s*is\s*better|sister\s*is\s*better|neighbor\s*is\s*better|parents\s*compare)/i,
      handler: () => ({
        badgeText: 'State: Social Comparison',
        badgeClass: 'level-medium',
        statusText: 'Rebuilding self-value...',
        avatar: '🪞',
        response: `Being compared to a sibling or neighbor hurts deeply${userName ? `, ${userName}` : ''}. But remember: life isn't a single race track. Your journey and potential are uniquely your own.`,
        careSteps: [
          '<strong>Unlink Your Worth:</strong> Other people\'s achievements do not lessen your personal value.',
          '<strong>Define Your Own Standard:</strong> Focus only on beating who you were yesterday.',
          '<strong>Boundaries:</strong> Kindly deflect comparison comments when family brings them up.'
        ]
      })
    },
  ];

  // --- RULE PROCESSOR ---
  function processRuleMatch(text) {
    if (conversationState === 'awaiting_stress_reason') {
      conversationState = null;
      return {
        badgeText: 'Stress Detected: Reason Identified',
        badgeClass: 'level-medium',
        statusText: 'Unpacking stress source...',
        avatar: '🌿',
        response: `Thank you for opening up about that${userName ? `, ${userName}` : ''}. Dealing with **"${escapeHTML(text)}"** can take a heavy toll. Would you like to break this situation down into smaller steps?`,
        careSteps: [
          '<strong>Step 1:</strong> Write down what you can control vs what you cannot.',
          '<strong>Step 2:</strong> Pause working on it for just 10 minutes.'
        ]
      };
    }

    for (const rule of rules) {
      const match = text.match(rule.pattern);
      if (match) {
        return rule.handler(text, match);
      }
    }

    return {
      badgeText: 'Emotional Check-In',
      badgeClass: 'level-low',
      statusText: 'Listening with care...',
      avatar: '🌿',
      response: `I'm listening${userName ? `, ${userName}` : ''}. Tell me a bit more about how you're feeling today.`,
      careSteps: [
        'Feel free to express yourself freely.',
        'I am here for emotional support and motivation.'
      ]
    };
  }

  // --- CHAT MANAGEMENT & LOCAL STORAGE ---
  function saveToLocalStorage() {
    localStorage.setItem('aura_chats', JSON.stringify(chats));
    localStorage.setItem('aura_current_chat_id', currentChatId);
  }

  function createNewChat(switchToIt = true) {
    const newChat = {
      id: 'chat_' + Date.now(),
      title: 'New Check-In',
      messages: [
        {
          sender: 'ai',
          time: 'Just now',
          text: `Welcome back! I'm here to listen, offer grounding thoughts, or give you a quick motivation push. How are you feeling today?`,
          match: null
        }
      ]
    };
    chats.unshift(newChat);
    if (switchToIt) {
      currentChatId = newChat.id;
    }
    saveToLocalStorage();
    renderChatList();
    renderCurrentChat();
  }

  function renderChatList() {
    if (!dynamicChatList) return;
    dynamicChatList.innerHTML = '';
    chats.forEach(chat => {
      const isSelected = chat.id === currentChatId;
      const wrapper = document.createElement('div');
      wrapper.className = `history-item-wrapper ${isSelected ? 'active' : ''}`;

      wrapper.innerHTML = `
        <a href="javascript:void(0)" class="history-item-link" data-id="${chat.id}">
          <span class="chat-icon">🌿</span>
          <span class="chat-title">${escapeHTML(chat.title)}</span>
        </a>
        <div class="chat-item-actions">
          <button class="icon-btn btn-rename" data-id="${chat.id}" title="Rename chat">✏️</button>
          <button class="icon-btn btn-delete" data-id="${chat.id}" title="Delete chat">🗑️</button>
        </div>
      `;
      dynamicChatList.appendChild(wrapper);
    });
  }

  function renderCurrentChat() {
    const chat = chats.find(c => c.id === currentChatId);
    if (!chat) return;

    chatMessages.innerHTML = '';
    chat.messages.forEach(msg => {
      if (msg.sender === 'user') {
        appendUserMessageDOM(msg.text, msg.time);
      } else {
        appendAIMessageDOM(msg, msg.time);
      }
    });
    scrollToBottom();
  }

  // --- DOM RENDERING HELPERS ---
  function appendUserMessageDOM(text, time = getCurrentTime()) {
    const html = `
      <div class="message user-message">
        <div class="avatar user-avatar">U</div>
        <div class="message-content">
          <div class="message-header">
            <span class="author">You</span>
            <span class="time">${time}</span>
          </div>
          <p>${escapeHTML(text)}</p>
        </div>
      </div>
    `;
    chatMessages.insertAdjacentHTML('beforeend', html);
    scrollToBottom();
  }

  function appendAIMessageDOM(msg, time = getCurrentTime()) {
    const match = msg.match || {};
    if (match.statusText) headerStatus.textContent = match.statusText;
    if (match.avatar) headerAvatar.textContent = match.avatar;

    let careStepsHTML = '';
    if (match.careSteps && match.careSteps.length > 0) {
      const items = match.careSteps.map(step => `<li>${step}</li>`).join('');
      careStepsHTML = `
        <div class="ai-panel emotional-panel">
          <div class="panel-header">
            <span>🌱 Care Plan</span>
            <span class="stress-badge ${match.badgeClass || 'level-low'}">${match.badgeText || 'Check-In'}</span>
          </div>
          <div class="panel-body">
            <ul>${items}</ul>
          </div>
        </div>
      `;
    }

    const html = `
      <div class="message ai-message">
        <div class="avatar ai-avatar">✨</div>
        <div class="message-content">
          <div class="message-header">
            <span class="author">Aura</span>
            <span class="time">${time}</span>
          </div>
          <p>${msg.text}</p>
          ${careStepsHTML}
          <div class="message-actions">
            <button class="btn-pill btn-that-helps">💚 That helps</button>
            <button class="btn-pill btn-need-motivation">🔥 Need motivation</button>
          </div>
        </div>
      </div>
    `;
    chatMessages.insertAdjacentHTML('beforeend', html);
    scrollToBottom();
  }

  function handleUserMessageSubmit(text) {
    const chat = chats.find(c => c.id === currentChatId);
    if (!chat) return;

    // First user message auto-renames title
    if (chat.title === 'New Check-In' && chat.messages.length <= 1) {
      chat.title = text.length > 22 ? text.substring(0, 22) + '...' : text;
      renderChatList();
    }

    const userMsg = { sender: 'user', text: text, time: getCurrentTime() };
    chat.messages.push(userMsg);
    appendUserMessageDOM(text, userMsg.time);

    setTimeout(() => {
      const matchResult = processRuleMatch(text);
      const aiMsg = {
        sender: 'ai',
        text: matchResult.response,
        time: getCurrentTime(),
        match: matchResult
      };
      chat.messages.push(aiMsg);
      appendAIMessageDOM(aiMsg, aiMsg.time);
      saveToLocalStorage();
    }, 400);

    saveToLocalStorage();
  }

  function getCurrentTime() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, tag => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag] || tag));
  }

  function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  // --- EVENT LISTENERS ---

  // 1. Submit Event Handler
  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = userInput.value.trim();
    if (!text) return;
    userInput.value = '';
    handleUserMessageSubmit(text);
  });

  // 2. Shift+Enter Support
  userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      chatForm.requestSubmit();
    }
  });

  // 3. Quick Mood Chips
  moodChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const moodType = chip.getAttribute('data-mood');
      let promptText = '';
      if (moodType === 'stressed') promptText = "I am stressed";
      if (moodType === 'down') promptText = "I feel overwhelmed";
      if (moodType === 'motivation') promptText = "I need motivation";
      if (moodType === 'calm') promptText = "I am feeling calm";

      handleUserMessageSubmit(promptText);
    });
  });

  // 4. In-Chat Action Buttons ("That helps" & "Need motivation")
  chatMessages.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-that-helps')) {
      handleUserMessageSubmit("That helps!");
    }
    if (e.target.classList.contains('btn-need-motivation')) {
      handleUserMessageSubmit("I need motivation");
    }
  });

  // 5. Sidebar Actions: Switch Chat, Rename & Delete
  if (dynamicChatList) {
    dynamicChatList.addEventListener('click', (e) => {
      const link = e.target.closest('.history-item-link');
      const renameBtn = e.target.closest('.btn-rename');
      const deleteBtn = e.target.closest('.btn-delete');

      // Switch Chat
      if (link) {
        e.preventDefault();
        currentChatId = link.getAttribute('data-id');
        saveToLocalStorage();
        renderChatList();
        renderCurrentChat();
      }

      // Rename Chat
      if (renameBtn) {
        e.stopPropagation();
        const id = renameBtn.getAttribute('data-id');
        const chat = chats.find(c => c.id === id);
        if (chat) {
          const newTitle = prompt("Enter new title for this chat:", chat.title);
          if (newTitle && newTitle.trim()) {
            chat.title = newTitle.trim();
            saveToLocalStorage();
            renderChatList();
          }
        }
      }

      // Delete Chat
      if (deleteBtn) {
        e.stopPropagation();
        const id = deleteBtn.getAttribute('data-id');
        if (confirm("Are you sure you want to delete this check-in?")) {
          chats = chats.filter(c => c.id !== id);
          if (chats.length === 0) {
            createNewChat(false);
          } else if (currentChatId === id) {
            currentChatId = chats[0].id;
          }
          saveToLocalStorage();
          renderChatList();
          renderCurrentChat();
        }
      }
    });
  }

  // 6. New Chat Button
  if (newChatBtn) {
    newChatBtn.addEventListener('click', () => {
      createNewChat(true);
    });
  }

  // 7. Clear All Chats Button
  if (clearAllChatsBtn) {
    clearAllChatsBtn.addEventListener('click', () => {
      if (confirm("Clear all chat histories?")) {
        chats = [];
        createNewChat(true);
      }
    });
  }

  // 8. Mood Log Header Button
  if (moodLogBtn) {
    moodLogBtn.addEventListener('click', () => {
      handleUserMessageSubmit("Show me my Mood Log");
    });
  }

  // Initial UI Setup Execution
  renderChatList();
  renderCurrentChat();

  const moodAnalyticsBtn = document.getElementById('moodAnalyticsBtn');
  const analyticsModal = document.getElementById('analyticsModal');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const chartContainer = document.getElementById('chartContainer');
  const analyticsStats = document.getElementById('analyticsStats');

  // Mood Keywords Mapping
  const moodPatterns = {
    stressed: /(stress|stressed|overwhelmed|workload|pressure|busy|burnout|harassment|caste|discrimination|comparison|better\s*than\s*me)/i,
    down: /(down|sad|anxious|anxiety|panic|depressed|uneasy|bad|trouble|childhood|trauma|suicide|lonely)/i,
    motivation: /(motivation|energy|focus|procrastinat|goal|drive|daily\s*routine|schedule)/i,
    calm: /(calm|peace|good|fine|relax|happy|great|well|peaceful)/i
  };

  function calculateMoodData() {
    const counts = { stressed: 0, down: 0, motivation: 0, calm: 0 };
    let totalCategorized = 0;

    chats.forEach(chat => {
      chat.messages.forEach(msg => {
        if (msg.sender === 'user') {
          const text = msg.text;
          let matched = false;

          if (moodPatterns.stressed.test(text)) { counts.stressed++; matched = true; }
          else if (moodPatterns.down.test(text)) { counts.down++; matched = true; }
          else if (moodPatterns.motivation.test(text)) { counts.motivation++; matched = true; }
          else if (moodPatterns.calm.test(text)) { counts.calm++; matched = true; }

          if (matched) totalCategorized++;
        }
      });
    });

    return { counts, totalCategorized };
  }

  function renderAnalyticsGraph() {
    const { counts, totalCategorized } = calculateMoodData();
    const maxVal = Math.max(counts.stressed, counts.down, counts.motivation, counts.calm, 1);

    const categories = [
      { key: 'stressed', label: '😰 Stressed', colorClass: 'bar-stressed' },
      { key: 'down', label: '😔 Down', colorClass: 'bar-down' },
      { key: 'motivation', label: '🔥 Energy', colorClass: 'bar-motivation' },
      { key: 'calm', label: '🌿 Calm', colorClass: 'bar-calm' }
    ];

    chartContainer.innerHTML = '';

    categories.forEach(cat => {
      const val = counts[cat.key];
      const heightPercent = Math.round((val / maxVal) * 100);

      const col = document.createElement('div');
      col.className = 'chart-column';
      col.innerHTML = `
        <span class="bar-count">${val}</span>
        <div class="bar-wrapper">
          <div class="bar-fill ${cat.colorClass}" style="height: 0%;"></div>
        </div>
        <span class="bar-label">${cat.label}</span>
      `;

      chartContainer.appendChild(col);

      setTimeout(() => {
        const fill = col.querySelector('.bar-fill');
        if (fill) fill.style.height = `${heightPercent}%`;
      }, 50);
    });

    analyticsStats.innerHTML = `
      <strong>Total Logged Entries Analyzed:</strong> ${totalCategorized}<br>
      <em>Data is persisted automatically in local storage across your check-in sessions.</em>
    `;
  }

  if (moodAnalyticsBtn) {
    moodAnalyticsBtn.addEventListener('click', () => {
      renderAnalyticsGraph();
      analyticsModal.classList.add('open');
    });
  }

  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => {
      analyticsModal.classList.remove('open');
    });
  }


const settingsBtn = document.querySelector('.settings-btn');
  const settingsModal = document.getElementById('settingsModal');
  const closeSettingsModalBtn = document.getElementById('closeSettingsModalBtn');
  const themeCards = document.querySelectorAll('.theme-card');

  // Load Saved Theme from LocalStorage
  const savedTheme = localStorage.getItem('aura_theme') || 'emerald';
  applyTheme(savedTheme);

  function applyTheme(themeName) {
    if (themeName === 'emerald') {
      document.body.removeAttribute('data-theme');
    } else {
      document.body.setAttribute('data-theme', themeName);
    }

    themeCards.forEach(card => {
      if (card.getAttribute('data-theme') === themeName) {
        card.classList.add('active');
      } else {
        card.classList.remove('active');
      }
    });

    localStorage.setItem('aura_theme', themeName);
  }

  // Open & Close Handlers
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      settingsModal.classList.add('open');
    });
  }

  if (closeSettingsModalBtn) {
    closeSettingsModalBtn.addEventListener('click', () => {
      settingsModal.classList.remove('open');
    });
  }


  window.addEventListener('click', (e) => {
    if (e.target === analyticsModal) {
      analyticsModal.classList.remove('open');
    }
  });

  themeCards.forEach(card => {
    card.addEventListener('click', () => {
      const selectedTheme = card.getAttribute('data-theme');
      applyTheme(selectedTheme);
    });
  });

});