document.addEventListener('DOMContentLoaded', () => {
    const sessionId = Math.random().toString(36).substring(2, 15);
    const textInput = document.getElementById('text-input');
    const sendButton = document.getElementById('send-button');
    const voiceSelect = document.getElementById('voice-select');
    
    // Core layouts and status elements
    const card = document.querySelector('.character-card');
    const characterImage = document.getElementById('character-image');
    const emotionBubble = document.getElementById('emotion-bubble');
    const glare = document.querySelector('.card-glare');
    
    const chatHistory = document.getElementById('chat-history');
    const characterStatus = document.getElementById('character-status');
    const voiceWave = document.getElementById('voice-wave');

    const openMouthImg = `/static/images/char-mouth-open.png?v=${sessionId}`;
    const closedMouthImg = `/static/images/char-mouth-closed.png?v=${sessionId}`;

    // Preload closed and open mouth mascot images
    const preloadOpen = new Image();
    preloadOpen.src = openMouthImg;
    const preloadClosed = new Image();
    preloadClosed.src = closedMouthImg;

    let voices = [];
    let lipSyncInterval;

    // --- CSS 3D PERSPECTIVE PARALLAX TILT EFFECT ---
    const handleMouseMove = (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left; // mouse x relative to card
        const y = e.clientY - rect.top;  // mouse y relative to card
        
        // Find center of card
        const xc = rect.width / 2;
        const yc = rect.height / 2;
        
        // Calculate tilt rotation angles (max ~15 degrees)
        const angleX = -(y - yc) / 10;
        const angleY = (x - xc) / 10;
        
        // Apply 3D rotation transform
        card.style.transform = `rotateX(${angleX}deg) rotateY(${angleY}deg)`;

        // Adjust glare opacity and position
        glare.style.opacity = 1;
        const glareX = (x / rect.width) * 100;
        const glareY = (y / rect.height) * 100;
        glare.style.background = `radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255, 255, 255, 0.22) 0%, rgba(255, 255, 255, 0) 75%)`;
    };

    const handleMouseLeave = () => {
        // Smoothly return card to default flat perspective
        card.style.transform = 'rotateX(0deg) rotateY(0deg)';
        glare.style.opacity = 0;
    };

    // Bind mouse events to character viewer for wide trigger area
    const viewer = document.querySelector('.character-viewer');
    viewer.addEventListener('mousemove', handleMouseMove);
    viewer.addEventListener('mouseleave', handleMouseLeave);


    // --- TTS AND VOICE LIST ---
    function populateVoiceList() {
        const allVoices = speechSynthesis.getVoices();
        
        // Filter English voices
        let englishVoices = allVoices.filter(v => v.lang.startsWith('en') || v.lang.startsWith('EN'));
        if (englishVoices.length === 0) {
            englishVoices = allVoices;
        }

        // Rank voices to prioritize natural female AI sounding voices
        const voiceKeywords = [
            'natural',            // Edge natural voices (very high quality)
            'samantha',           // macOS default female voice
            'google us english',  // Chrome default female voice
            'google uk english female',
            'zira',               // Windows default female voice
            'hazel',              // Windows default female voice
            'victoria',           // macOS female voice
            'aria',               // Edge female voice
            'female'
        ];

        englishVoices.sort((a, b) => {
            const nameA = a.name.toLowerCase();
            const nameB = b.name.toLowerCase();
            
            let scoreA = 0;
            let scoreB = 0;
            
            voiceKeywords.forEach((kw, index) => {
                const weight = voiceKeywords.length - index;
                if (nameA.includes(kw)) scoreA += weight;
                if (nameB.includes(kw)) scoreB += weight;
            });
            
            return scoreB - scoreA;
        });

        voices = englishVoices;
        voiceSelect.innerHTML = '';

        voices.forEach((voice, i) => {
            const option = document.createElement('option');
            option.textContent = `${voice.name} (${voice.lang})`;
            option.setAttribute('data-lang', voice.lang);
            option.setAttribute('data-name', voice.name);
            voiceSelect.appendChild(option);
        });

        if (voices.length > 0) {
            voiceSelect.selectedIndex = 0;
        }
    }

    populateVoiceList();
    if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = populateVoiceList;
    }

    // --- TYPEWRITER EFFECT WITH AUTO SCROLL ---
    let typewriterTimeout;
    const typewriter = (text, element, speed = 30) => {
        if (typewriterTimeout) {
            clearTimeout(typewriterTimeout);
        }

        if (window.Intl && Intl.Segmenter) {
            const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
            const segments = Array.from(segmenter.segment(text)).map(s => s.segment);
            
            let i = 0;
            element.innerHTML = "";

            function type() {
                if (i < segments.length) {
                    element.innerHTML += segments[i];
                    i++;
                    chatHistory.scrollTop = chatHistory.scrollHeight; // Auto-scroll
                    typewriterTimeout = setTimeout(type, speed);
                }
            }
            type();
        } else {
            let i = 0;
            element.innerHTML = "";
            function type() {
                if (i < text.length) {
                    element.innerHTML += text.charAt(i);
                    i++;
                    chatHistory.scrollTop = chatHistory.scrollHeight; // Auto-scroll
                    typewriterTimeout = setTimeout(type, speed);
                }
            }
            type();
        }
    };

    // --- EMOTION MANAGER ---
    const emojis = {
        neutral: '🐱',
        happy: '❤️',
        sad: '💧',
        angry: '💢',
        surprised: '⚡'
    };

    const setExpression = (emotion) => {
        // Reset CSS classes on card container and bubble
        const allEmotions = ['neutral', 'happy', 'sad', 'angry', 'surprised'];
        allEmotions.forEach(emo => {
            card.classList.remove(emo);
            emotionBubble.classList.remove(emo);
        });

        const validEmotion = allEmotions.includes(emotion) ? emotion : 'neutral';
        card.classList.add(validEmotion);
        emotionBubble.classList.add(validEmotion);

        // Update Emoji Symbol
        emotionBubble.textContent = emojis[validEmotion] || emojis.neutral;

        // Activate float bubble if not neutral
        if (validEmotion !== 'neutral') {
            emotionBubble.classList.add('active');
        } else {
            emotionBubble.classList.remove('active');
        }
    };

    // --- SPEECH UTTERANCE ENGINE WITH WORD-SYNC AND VISUAL WAVES ---
    const speak = (text) => {
        if (speechSynthesis.speaking) {
            speechSynthesis.cancel();
        }
        clearInterval(lipSyncInterval);
        characterImage.src = closedMouthImg; // Close mouth initially

        const utterance = new SpeechSynthesisUtterance(text);
        
        // Restore previous standard voice pitch & speed defaults
        utterance.pitch = 1.0; 
        utterance.rate = 1.0;

        const selectedOption = (voiceSelect.selectedOptions && voiceSelect.selectedOptions.length > 0)
            ? voiceSelect.selectedOptions[0].getAttribute('data-name')
            : null;
        if (selectedOption) {
            const selectedVoice = voices.find(voice => voice.name === selectedOption);
            if (selectedVoice) {
                utterance.voice = selectedVoice;
            }
        }

        let boundaryCalled = false;

        // Sync original 2D image mouth flap with spoken words
        utterance.onboundary = (event) => {
            if (event.name === 'word') {
                boundaryCalled = true;
                characterImage.src = openMouthImg;
                setTimeout(() => {
                    if (speechSynthesis.speaking) {
                        characterImage.src = closedMouthImg;
                    }
                }, 110); // Close mouth after 110ms
            }
        };

        utterance.onstart = () => {
            // Activate voice wave and speaking text
            voiceWave.classList.add('speaking');
            characterStatus.classList.add('speaking');
            characterStatus.textContent = "Waku is speaking";

            // Fallback: if browser SpeechSynthesis doesn't fire boundary events
            setTimeout(() => {
                if (!boundaryCalled && speechSynthesis.speaking) {
                    console.log("Boundary events not firing. Falling back to interval lip-sync.");
                    lipSyncInterval = setInterval(() => {
                        let isClosed = characterImage.src.includes('closed');
                        characterImage.src = isClosed ? openMouthImg : closedMouthImg;
                    }, 150);
                }
            }, 600);
        };

        const stopSpeakingVisuals = () => {
            clearInterval(lipSyncInterval);
            characterImage.src = closedMouthImg;
            voiceWave.classList.remove('speaking');
            characterStatus.classList.remove('speaking');
            characterStatus.textContent = "Waku is listening";
        };

        utterance.onend = stopSpeakingVisuals;
        utterance.onerror = stopSpeakingVisuals;

        speechSynthesis.speak(utterance);
    };

    // --- CHAT MESSAGE DISPATCHER ---
    const handleSendMessage = async () => {
        const message = textInput.value.trim();
        if (!message) return;

        textInput.disabled = true;
        sendButton.disabled = true;
        textInput.value = '';
        textInput.style.height = '48px';

        // 1. Add user bubble to chat history
        const userMsg = document.createElement('div');
        userMsg.className = 'message user-message';
        userMsg.innerHTML = `
            <div class="message-avatar">👤</div>
            <div class="message-bubble">
                <div class="message-text">${message}</div>
            </div>
        `;
        chatHistory.appendChild(userMsg);
        chatHistory.scrollTop = chatHistory.scrollHeight; // scroll down

        // Update status
        characterStatus.textContent = "Waku is thinking...";

        // 2. Add Waku typing indicator bubble
        const typingMsg = document.createElement('div');
        typingMsg.className = 'message waku-message typing-indicator-msg';
        typingMsg.innerHTML = `
            <div class="message-avatar">🐱</div>
            <div class="message-bubble">
                <div class="typing-dots">
                    <span></span><span></span><span></span>
                </div>
            </div>
        `;
        chatHistory.appendChild(typingMsg);
        chatHistory.scrollTop = chatHistory.scrollHeight;

        try {
            const response = await fetch('/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message: message, session_id: sessionId }),
            });

            // Remove typing bubble
            typingMsg.remove();

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const data = await response.json();
            setExpression(data.emotion || 'neutral');

            // 3. Add Waku reply bubble and start typewriter
            const wakuMsg = document.createElement('div');
            wakuMsg.className = 'message waku-message';
            wakuMsg.innerHTML = `
                <div class="message-avatar">🐱</div>
                <div class="message-bubble">
                    <div class="message-text"></div>
                </div>
            `;
            chatHistory.appendChild(wakuMsg);
            const wakuTextEl = wakuMsg.querySelector('.message-text');

            typewriter(data.response, wakuTextEl);
            speak(data.response);
        } catch (error) {
            console.error('Error:', error);
            typingMsg.remove();
            
            const errorMessage = 'Meow... sorry, my brain got a bit fuzzy. Can you ask again, meow?';
            
            const errorMsg = document.createElement('div');
            errorMsg.className = 'message waku-message';
            errorMsg.innerHTML = `
                <div class="message-avatar">🐱</div>
                <div class="message-bubble">
                    <div class="message-text"></div>
                </div>
            `;
            chatHistory.appendChild(errorMsg);
            const errorTextEl = errorMsg.querySelector('.message-text');
            
            typewriter(errorMessage, errorTextEl);
            speak(errorMessage);
        } finally {
            textInput.disabled = false;
            sendButton.disabled = false;
            textInput.focus();
        }
    };

    sendButton.addEventListener('click', handleSendMessage);

    textInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });

    textInput.addEventListener('input', () => {
        textInput.style.height = 'auto';
        textInput.style.height = `${textInput.scrollHeight}px`;
    });

});
