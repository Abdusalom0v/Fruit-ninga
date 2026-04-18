const video = document.getElementById('video');
        const canvas = document.getElementById('canvas');
        const gameCanvas = document.getElementById('gameCanvas');
        const ctx = canvas.getContext('2d');
        const gameCtx = gameCanvas.getContext('2d');
        const loading = document.getElementById('loading');

        let score = 0;
        let timeLeft = 60;
        let lives = 3;
        let gameActive = false;
        let fingerTip = null;
        let fruits = [];
        let sliceTrail = [];
        let particles = [];
        let gameTimer = null;
        let spawnTimer = null;

        // Звуковые эффекты
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        function playSliceSound() {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.1);
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.1);
        }
        
        function playBombSound() {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.type = 'sawtooth';
            oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(50, audioContext.currentTime + 0.3);
            
            gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.3);
        }

        // Классы фруктов
        const fruitTypes = [
            { name: 'apple', color: '#ff4444', emoji: '🍎', points: 10 },
            { name: 'orange', color: '#ff8833', emoji: '🍊', points: 10 },
            { name: 'banana', color: '#ffee33', emoji: '🍌', points: 15 },
            { name: 'watermelon', color: '#44ff88', emoji: '🍉', points: 20 },
            { name: 'bomb', color: '#333333', emoji: '💣', points: -50, isBomb: true }
        ];

        class Fruit {
            constructor() {
                const type = Math.random() < 0.15 ? fruitTypes[4] : fruitTypes[Math.floor(Math.random() * 4)];
                this.type = type;
                // Спавн в центральной 70% области экрана по горизонтали
                const margin = gameCanvas.width * 0.15;
                this.x = margin + Math.random() * (gameCanvas.width - margin * 2);
                
                // Спавн снизу за экраном
                this.y = gameCanvas.height + 50;
                
                // Более сильный начальный импульс вверх для достижения верхней половины экрана
                this.vx = (Math.random() - 0.5) * 4;
                this.vy = -(14 + Math.random() * 8); // Увеличенная скорость вверх
                
                this.rotation = Math.random() * Math.PI * 2;
                this.rotationSpeed = (Math.random() - 0.5) * 0.15;
                this.size = 50 + Math.random() * 20;
                this.sliced = false;
                this.gravity = 0.4; // Немного увеличенная гравитация для красивой дуги
            }

            update() {
                this.vy += this.gravity;
                this.x += this.vx;
                this.y += this.vy;
                this.rotation += this.rotationSpeed;
            }

            draw() {
                gameCtx.save();
                gameCtx.translate(this.x, this.y);
                gameCtx.rotate(this.rotation);
                gameCtx.font = `${this.size}px Arial`;
                gameCtx.textAlign = 'center';
                gameCtx.textBaseline = 'middle';
                gameCtx.fillText(this.type.emoji, 0, 0);
                gameCtx.restore();
            }

            isOffScreen() {
                return this.y > gameCanvas.height + 100;
            }

            checkCollision(x, y) {
                const dx = this.x - x;
                const dy = this.y - y;
                return Math.sqrt(dx * dx + dy * dy) < this.size / 2;
            }

            slice() {
                if (this.sliced) return;
                this.sliced = true;

                // Создание частиц
                for (let i = 0; i < 15; i++) {
                    particles.push({
                        x: this.x,
                        y: this.y,
                        vx: (Math.random() - 0.5) * 10,
                        vy: (Math.random() - 0.5) * 10 - 5,
                        color: this.type.color,
                        size: Math.random() * 8 + 4,
                        life: 1
                    });
                }

                if (this.type.isBomb) {
                    playBombSound();
                    lives--;
                    updateLives();
                    if (lives <= 0) {
                        endGame();
                    }
                    // Эффект взрыва
                    for (let i = 0; i < 30; i++) {
                        particles.push({
                            x: this.x,
                            y: this.y,
                            vx: (Math.random() - 0.5) * 20,
                            vy: (Math.random() - 0.5) * 20,
                            color: '#ff6600',
                            size: Math.random() * 12 + 6,
                            life: 1
                        });
                    }
                } else {
                    playSliceSound();
                    score += this.type.points;
                    updateScore();
                }
            }
        }

        function updateScore() {
            document.getElementById('score').textContent = score;
        }

        function updateTimer() {
            document.getElementById('timer').textContent = timeLeft;
        }

        function updateLives() {
            document.getElementById('lives').textContent = '❤️'.repeat(lives);
        }

        function spawnFruit() {
            if (!gameActive) return;
            fruits.push(new Fruit());
        }

        function updateGame() {
            if (!gameActive) return;

            // Очистка игрового canvas
            gameCtx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);

            // Обновление и отрисовка фруктов
            fruits = fruits.filter(fruit => {
                fruit.update();
                if (!fruit.sliced) {
                    fruit.draw();
                }
                
                if (fruit.isOffScreen() && !fruit.sliced && !fruit.type.isBomb) {
                    // Фрукт упал - минус жизнь
                    lives--;
                    updateLives();
                    if (lives <= 0) {
                        endGame();
                    }
                    return false;
                }
                
                return !fruit.isOffScreen();
            });

            // След пальца
            if (sliceTrail.length > 0) {
                gameCtx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
                gameCtx.lineWidth = 5;
                gameCtx.lineCap = 'round';
                gameCtx.beginPath();
                gameCtx.moveTo(sliceTrail[0].x, sliceTrail[0].y);
                for (let i = 1; i < sliceTrail.length; i++) {
                    gameCtx.lineTo(sliceTrail[i].x, sliceTrail[i].y);
                }
                gameCtx.stroke();

                // Проверка столкновений со следом
                sliceTrail.forEach(point => {
                    fruits.forEach(fruit => {
                        if (!fruit.sliced && fruit.checkCollision(point.x, point.y)) {
                            fruit.slice();
                        }
                    });
                });
            }

            // Частицы
            particles = particles.filter(p => {
                p.vy += 0.3;
                p.x += p.vx;
                p.y += p.vy;
                p.life -= 0.02;

                if (p.life > 0) {
                    gameCtx.fillStyle = p.color;
                    gameCtx.globalAlpha = p.life;
                    gameCtx.beginPath();
                    gameCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                    gameCtx.fill();
                    gameCtx.globalAlpha = 1;
                    return true;
                }
                return false;
            });

            // Отрисовка позиции пальца - яркая жёлтая точка
            if (fingerTip) {
                // Внешнее свечение
                gameCtx.shadowBlur = 20;
                gameCtx.shadowColor = 'rgba(255, 255, 0, 0.8)';
                gameCtx.fillStyle = 'rgba(255, 255, 0, 0.9)';
                gameCtx.beginPath();
                gameCtx.arc(fingerTip.x, fingerTip.y, 18, 0, Math.PI * 2);
                gameCtx.fill();
                
                // Внутренний круг
                gameCtx.shadowBlur = 0;
                gameCtx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                gameCtx.beginPath();
                gameCtx.arc(fingerTip.x, fingerTip.y, 8, 0, Math.PI * 2);
                gameCtx.fill();
            }

            requestAnimationFrame(updateGame);
        }

        function startGame() {
            document.getElementById('startScreen').style.display = 'none';
            score = 0;
            timeLeft = 60;
            lives = 3;
            fruits = [];
            particles = [];
            gameActive = true;
            updateScore();
            updateTimer();
            updateLives();

            // Таймер игры
            gameTimer = setInterval(() => {
                timeLeft--;
                updateTimer();
                if (timeLeft <= 0) {
                    endGame();
                }
            }, 1000);

            // Спавн фруктов
            spawnTimer = setInterval(spawnFruit, 800);

            updateGame();
        }

        function endGame() {
            gameActive = false;
            clearInterval(gameTimer);
            clearInterval(spawnTimer);
            document.getElementById('finalScore').textContent = score;
            document.getElementById('gameOverScreen').style.display = 'flex';
        }

        function restartGame() {
            document.getElementById('gameOverScreen').style.display = 'none';
            startGame();
        }

        // MediaPipe Hands
        const hands = new Hands({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
            }
        });

        hands.setOptions({
            maxNumHands: 1,
            modelComplexity: 1,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        hands.onResults(onResults);

        function onResults(results) {
            ctx.save();
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

            if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
                const landmarks = results.multiHandLandmarks[0];
                const indexTip = landmarks[8]; // Кончик указательного пальца

                // Преобразование координат (отзеркалено для естественного управления)
                const x = (1 - indexTip.x) * gameCanvas.width;
                const y = indexTip.y * gameCanvas.height;

                fingerTip = { x, y };

                // Добавление в след
                sliceTrail.push({ x, y });
                if (sliceTrail.length > 15) {
                    sliceTrail.shift();
                }
            } else {
                sliceTrail = [];
                fingerTip = null;
            }

            ctx.restore();
        }

        function drawConnectors(ctx, landmarks, connections, style) {
            ctx.strokeStyle = style.color;
            ctx.lineWidth = style.lineWidth;
            connections.forEach(([start, end]) => {
                const startPoint = landmarks[start];
                const endPoint = landmarks[end];
                ctx.beginPath();
                ctx.moveTo((1 - startPoint.x) * canvas.width, startPoint.y * canvas.height);
                ctx.lineTo((1 - endPoint.x) * canvas.width, endPoint.y * canvas.height);
                ctx.stroke();
            });
        }

        function drawLandmarks(ctx, landmarks, style) {
            ctx.fillStyle = style.color;
            landmarks.forEach(landmark => {
                ctx.beginPath();
                ctx.arc((1 - landmark.x) * canvas.width, landmark.y * canvas.height, 3, 0, 2 * Math.PI);
                ctx.fill();
            });
        }

        const HAND_CONNECTIONS = [
            [0,1],[1,2],[2,3],[3,4],
            [0,5],[5,6],[6,7],[7,8],
            [5,9],[9,10],[10,11],[11,12],
            [9,13],[13,14],[14,15],[15,16],
            [13,17],[17,18],[18,19],[19,20],[0,17]
        ];

        // Инициализация камеры
        async function initCamera() {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { 
                        facingMode: 'user',
                        width: { ideal: 1280 },
                        height: { ideal: 720 }
                    }
                });
                video.srcObject = stream;
                
                video.onloadedmetadata = () => {
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    gameCanvas.width = video.videoWidth;
                    gameCanvas.height = video.videoHeight;
                    
                    loading.style.display = 'none';
                    
                    const camera = new Camera(video, {
                        onFrame: async () => {
                            await hands.send({image: video});
                        },
                        width: video.videoWidth,
                        height: video.videoHeight
                    });
                    camera.start();
                };
            } catch (error) {
                loading.textContent = 'Error accessing camera. Allow access to the camera.';
                console.error('Camera error:', error);
            }
        }

        initCamera();