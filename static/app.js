document.addEventListener('DOMContentLoaded', () => {
    const sessionId = Math.random().toString(36).substring(2, 15);
    const textInput = document.getElementById('text-input');
    const sendButton = document.getElementById('send-button');
    const characterImage = document.getElementById('character-image');
    const voiceSelect = document.getElementById('voice-select');
    const status = document.getElementById('status');

    const openMouthImg = `/static/images/char-mouth-open.png?v=${sessionId}`;
    const closedMouthImg = `/static/images/char-mouth-closed.png?v=${sessionId}`;
    const emotionBubble = document.getElementById('emotion-bubble');

    // Preload closed and open mouth images
    const preloadOpen = new Image();
    preloadOpen.src = openMouthImg;
    const preloadClosed = new Image();
    preloadClosed.src = closedMouthImg;

    // Set initial state
    characterImage.src = closedMouthImg;

    let voices = [];
    let lipSyncInterval;

    function populateVoiceList() {
        const allVoices = speechSynthesis.getVoices();
        voices = allVoices.filter(voice => voice.name.includes('Google'));
        if (voices.length === 0) {
            voices = allVoices.filter(voice => voice.lang.startsWith('en'));
            if (voices.length === 0) {
                voices = allVoices;
            }
        }
        voiceSelect.innerHTML = '';

        let usVoiceIndex = -1;

        voices.forEach((voice, i) => {
            const option = document.createElement('option');
            option.textContent = `${voice.name} (${voice.lang})`;
            option.setAttribute('data-lang', voice.lang);
            option.setAttribute('data-name', voice.name);
            voiceSelect.appendChild(option);

            if (voice.lang === 'en-US') {
                if (usVoiceIndex === -1) { // Find the first US voice
                    usVoiceIndex = i;
                }
            }
        });

        if (usVoiceIndex !== -1) {
            voiceSelect.selectedIndex = usVoiceIndex;
        }
    }

    populateVoiceList();
    if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = populateVoiceList;
    }

    let typewriterTimeout;

    const typewriter = (text, element, speed = 50) => {
        if (typewriterTimeout) {
            clearTimeout(typewriterTimeout);
        }

        // Use Intl.Segmenter to handle grapheme clusters correctly
        if (window.Intl && Intl.Segmenter) {
            const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
            const segments = Array.from(segmenter.segment(text)).map(s => s.segment);
            
            let i = 0;
            element.innerHTML = "";

            function type() {
                if (i < segments.length) {
                    element.innerHTML += segments[i];
                    i++;
                    typewriterTimeout = setTimeout(type, speed);
                }
            }
            type();
        } else {
            // Fallback for older browsers
            let i = 0;
            element.innerHTML = "";
            function type() {
                if (i < text.length) {
                    element.innerHTML += text.charAt(i);
                    i++;
                    typewriterTimeout = setTimeout(type, speed);
                }
            }
            type();
        }
    };

    const emojis = {
        neutral: '🐱',
        happy: '❤️',
        sad: '💧',
        angry: '💢',
        surprised: '⚡'
    };

    const setExpression = (emotion) => {
        // Remove existing emotion classes
        const allEmotions = ['neutral', 'happy', 'sad', 'angry', 'surprised'];
        allEmotions.forEach(emo => {
            characterImage.classList.remove(emo);
            emotionBubble.classList.remove(emo);
        });

        // Add new emotion classes
        const validEmotion = allEmotions.includes(emotion) ? emotion : 'neutral';
        characterImage.classList.add(validEmotion);
        emotionBubble.classList.add(validEmotion);

        // Update emoji display
        emotionBubble.textContent = emojis[validEmotion] || emojis.neutral;

        // Activate float bubble if not neutral
        if (validEmotion !== 'neutral') {
            emotionBubble.classList.add('active');
        } else {
            emotionBubble.classList.remove('active');
        }
    };

    const speak = (text) => {
        if (speechSynthesis.speaking) {
            speechSynthesis.cancel();
        }
        clearInterval(lipSyncInterval);
        characterImage.src = closedMouthImg;

        const utterance = new SpeechSynthesisUtterance(text);
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

        // Primary: flap the mouth on every spoken word boundary for precise timing
        utterance.onboundary = (event) => {
            if (event.name === 'word') {
                boundaryCalled = true;
                characterImage.src = openMouthImg;
                setTimeout(() => {
                    if (speechSynthesis.speaking) {
                        characterImage.src = closedMouthImg;
                    }
                }, 100); // Close mouth 100ms after opening
            }
        };

        utterance.onstart = () => {
            // Secondary Fallback: if browser doesn't fire boundary events, start interval lip sync
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

        utterance.onend = () => {
            clearInterval(lipSyncInterval);
            characterImage.src = closedMouthImg;
        };

        utterance.onerror = () => {
            clearInterval(lipSyncInterval);
            characterImage.src = closedMouthImg;
        };

        speechSynthesis.speak(utterance);
    };

    const handleSendMessage = async () => {
        const message = textInput.value.trim();
        if (!message) return;

        // Disable input while request is processing
        textInput.disabled = true;
        sendButton.disabled = true;

        textInput.value = '';
        textInput.style.height = '50px';
        status.textContent = "Thinking...";

        try {
            const response = await fetch('/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message: message, session_id: sessionId }),
            });

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const data = await response.json();
            setExpression(data.emotion || 'neutral');
            typewriter(data.response, status);
            speak(data.response);
        } catch (error) {
            console.error('Error:', error);
            const errorMessage = 'Sorry, something went wrong. Please try again.';
            typewriter(errorMessage, status);
            speak(errorMessage);
        } finally {
            // Re-enable inputs
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
