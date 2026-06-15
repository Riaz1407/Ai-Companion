document.addEventListener('DOMContentLoaded', () => {
    const sessionId = Math.random().toString(36).substring(2, 15);
    const textInput = document.getElementById('text-input');
    const sendButton = document.getElementById('send-button');
    const characterImage = document.getElementById('character-image');
    const voiceSelect = document.getElementById('voice-select');
    const status = document.getElementById('status');

    let currentOpenImg = `/static/images/char-neutral-open.png?v=${sessionId}`;
    let currentClosedImg = `/static/images/char-neutral-closed.png?v=${sessionId}`;

    // Preload all expressions to avoid flickering
    const emotions = ['neutral', 'happy', 'sad', 'angry', 'surprised'];
    emotions.forEach(emo => {
        const imgOpen = new Image();
        imgOpen.src = `/static/images/char-${emo}-open.png?v=${sessionId}`;
        const imgClosed = new Image();
        imgClosed.src = `/static/images/char-${emo}-closed.png?v=${sessionId}`;
    });

    // Set initial state
    characterImage.src = currentClosedImg;

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

    const setExpression = (emotion) => {
        currentOpenImg = `/static/images/char-${emotion}-open.png?v=${sessionId}`;
        currentClosedImg = `/static/images/char-${emotion}-closed.png?v=${sessionId}`;
        characterImage.src = currentClosedImg;
    };

    const speak = (text) => {
        if (speechSynthesis.speaking) {
            speechSynthesis.cancel();
        }
        clearInterval(lipSyncInterval);

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

        utterance.onstart = () => {
            let mouthOpen = true;
            lipSyncInterval = setInterval(() => {
                characterImage.src = mouthOpen ? currentOpenImg : currentClosedImg;
                mouthOpen = !mouthOpen;
            }, 150);
        };

        utterance.onend = () => {
            clearInterval(lipSyncInterval);
            characterImage.src = currentClosedImg;
        };

        utterance.onerror = () => {
            clearInterval(lipSyncInterval);
            characterImage.src = currentClosedImg;
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
