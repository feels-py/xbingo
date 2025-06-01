document.addEventListener('DOMContentLoaded', function() {
    const waitingScreen = document.getElementById('waitingScreen');
    const drawingScreen = document.getElementById('drawingScreen');
    const winnerScreen = document.getElementById('winnerScreen');
    const numberDisplay = document.getElementById('numberDisplay');
    const numbersGrid = document.getElementById('numbersGrid');
    const prizeImage = document.getElementById('prizeImage');
    const sponsorsContainer = document.getElementById('sponsors');
    
    let drawnNumbers = [];
    let isDrawing = false;
    let socket;
    
    // Conectar ao servidor para atualizações em tempo real
    function connectWebSocket() {
        socket = new WebSocket(`ws://${window.location.host}/ws`);
        
        socket.onopen = function(e) {
            console.log('Conexão WebSocket estabelecida');
        };
        
        socket.onmessage = function(event) {
            const data = JSON.parse(event.data);
            
            if (data.type === 'settings_update') {
                updateUI(data.settings);
            } else if (data.type === 'number_drawn') {
                handleNumberDrawn(data.number, data.hasWinner, data.winner);
            }
        };
        
        socket.onclose = function(event) {
            if (event.wasClean) {
                console.log(`Conexão fechada limpamente, código=${event.code} motivo=${event.reason}`);
            } else {
                console.log('Conexão perdida');
            }
            
            // Tentar reconectar após 5 segundos
            setTimeout(connectWebSocket, 5000);
        };
        
        socket.onerror = function(error) {
            console.log('Erro no WebSocket:', error);
        };
    }
    
    // Atualizar a interface com as configurações
    function updateUI(settings) {
        // Atualizar patrocinadores
        sponsorsContainer.innerHTML = '';
        if (settings.sponsor_images && settings.sponsor_images.length > 0) {
            settings.sponsor_images.forEach(img => {
                const sponsorImg = document.createElement('img');
                sponsorImg.src = `/static/images/sponsors/${img}`;
                sponsorImg.alt = 'Patrocinador';
                sponsorImg.className = 'sponsor-img';
                sponsorsContainer.appendChild(sponsorImg);
            });
        }
        
        // Atualizar imagem do prêmio
        if (settings.prize_image) {
            prizeImage.src = `/static/images/${settings.prize_image}`;
        }
        
        // Atualizar estado do sorteio
        isDrawing = settings.is_drawing;
        drawnNumbers = settings.drawn_numbers || [];
        
        if (settings.has_winner) {
            showWinnerScreen(settings.winner);
        } else if (isDrawing) {
            showDrawingScreen();
            updateDrawnNumbers(drawnNumbers);
        } else {
            showWaitingScreen();
        }
        
        // Mostrar contagem regressiva se estiver definida
        if (settings.countdown_time) {
            const countdownTime = new Date(settings.countdown_time).getTime();
            const now = new Date().getTime();
            
            if (countdownTime > now) {
                startCountdown(countdownTime);
            }
        }
    }
    
    // Mostrar tela de espera
    function showWaitingScreen() {
        waitingScreen.style.display = 'block';
        drawingScreen.style.display = 'none';
        winnerScreen.style.display = 'none';
    }
    
    // Mostrar tela de sorteio
    function showDrawingScreen() {
        waitingScreen.style.display = 'none';
        drawingScreen.style.display = 'block';
        winnerScreen.style.display = 'none';
    }
    
    // Mostrar tela de vencedor
    function showWinnerScreen(winner) {
        waitingScreen.style.display = 'none';
        drawingScreen.style.display = 'none';
        winnerScreen.style.display = 'block';
        
        if (winner) {
            document.getElementById('winnerId').textContent = winner.card_id;
            document.getElementById('winnerName').textContent = winner.name;
            
            const winnerNumbersContainer = document.getElementById('winnerNumbers');
            winnerNumbersContainer.innerHTML = '';
            
            winner.numbers.forEach(num => {
                const numElement = document.createElement('div');
                numElement.className = 'winner-number';
                numElement.textContent = num;
                winnerNumbersContainer.appendChild(numElement);
            });
        }
        
        // Animação de confetes
        celebrate();
    }
    
    // Atualizar números sorteados
    function updateDrawnNumbers(numbers) {
        numbersGrid.innerHTML = '';
        
        // Criar células para todos os números possíveis (1-75)
        for (let i = 1; i <= 75; i++) {
            const cell = document.createElement('div');
            cell.className = 'number-cell';
            cell.textContent = i;
            
            if (numbers.includes(i)) {
                cell.style.backgroundColor = '#2ecc71';
            } else {
                cell.style.backgroundColor = '#ecf0f1';
                cell.style.color = '#7f8c8d';
            }
            
            numbersGrid.appendChild(cell);
        }
    }
    
    // Lidar com novo número sorteado
    function handleNumberDrawn(number, hasWinner, winner) {
        numberDisplay.textContent = number;
        
        // Adicionar animação
        numberDisplay.style.transform = 'scale(1.2)';
        numberDisplay.style.color = '#e74c3c';
        
        setTimeout(() => {
            numberDisplay.style.transform = 'scale(1)';
            numberDisplay.style.color = 'white';
        }, 500);
        
        if (hasWinner) {
            showWinnerScreen(winner);
        } else {
            drawnNumbers.push(number);
            updateDrawnNumbers(drawnNumbers);
        }
    }
    
    // Iniciar contagem regressiva
    function startCountdown(endTime) {
        const countdownElement = document.createElement('div');
        countdownElement.className = 'countdown';
        waitingScreen.appendChild(countdownElement);
        
        const interval = setInterval(() => {
            const now = new Date().getTime();
            const distance = endTime - now;
            
            if (distance < 0) {
                clearInterval(interval);
                countdownElement.remove();
                return;
            }
            
            const days = Math.floor(distance / (1000 * 60 * 60 * 24));
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);
            
            countdownElement.innerHTML = `
                <h3>Próximo sorteio em:</h3>
                <div class="countdown-timer">
                    ${days}d ${hours}h ${minutes}m ${seconds}s
                </div>
            `;
        }, 1000);
    }
    
    // Animação de confetes
    function celebrate() {
        // Implementação simplificada - pode ser substituída por uma biblioteca como canvas-confetti
        const colors = ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71', '#9b59b6'];
        
        for (let i = 0; i < 100; i++) {
            setTimeout(() => {
                const confetti = document.createElement('div');
                confetti.className = 'confetti';
                confetti.style.left = `${Math.random() * 100}%`;
                confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
                confetti.style.transform = `rotate(${Math.random() * 360}deg)`;
                document.body.appendChild(confetti);
                
                setTimeout(() => {
                    confetti.remove();
                }, 3000);
            }, i * 30);
        }
    }
    
    // Carregar configurações iniciais
    fetch('/api/settings')
        .then(response => response.json())
        .then(settings => {
            updateUI(settings);
            connectWebSocket();
        })
        .catch(error => console.error('Erro ao carregar configurações:', error));
    
    // Adicionar estilo para confetes
    const style = document.createElement('style');
    style.textContent = `
        .confetti {
            position: fixed;
            width: 10px;
            height: 10px;
            top: -10px;
            z-index: 9999;
            animation: fall linear forwards;
        }
        
        @keyframes fall {
            to {
                transform: translateY(100vh);
            }
        }
    `;
    document.head.appendChild(style);
});