document.addEventListener('DOMContentLoaded', function() {
    const cardForm = document.getElementById('cardForm');
    const cardsTableBody = document.getElementById('cardsTableBody');
    const countdownTimeInput = document.getElementById('countdownTime');
    const setCountdownBtn = document.getElementById('setCountdown');
    const startDrawingBtn = document.getElementById('startDrawing');
    const drawNumberBtn = document.getElementById('drawNumber');
    const resetDrawingBtn = document.getElementById('resetDrawing');
    const sponsorImageInput = document.getElementById('sponsorImage');
    const uploadSponsorBtn = document.getElementById('uploadSponsor');
    const sponsorsPreview = document.getElementById('sponsorsPreview');
    const prizeImageInput = document.getElementById('prizeImage');
    const uploadPrizeBtn = document.getElementById('uploadPrize');
    const prizePreview = document.getElementById('prizePreview');
    
    let settings = {};
    let cards = [];
    
    // Carregar dados iniciais
    function loadInitialData() {
        fetch('/api/settings')
            .then(response => response.json())
            .then(data => {
                settings = data;
                updateSettingsUI();
            });
        
        fetch('/api/cards')
            .then(response => response.json())
            .then(data => {
                cards = data;
                renderCardsTable();
            });
    }
    
    // Atualizar UI com as configurações
    function updateSettingsUI() {
        if (settings.countdown_time) {
            const date = new Date(settings.countdown_time);
            const localDateTime = date.toISOString().slice(0, 16);
            countdownTimeInput.value = localDateTime;
        }
        
        // Atualizar preview dos patrocinadores
        sponsorsPreview.innerHTML = '';
        if (settings.sponsor_images && settings.sponsor_images.length > 0) {
            settings.sponsor_images.forEach(img => {
                addSponsorPreview(img);
            });
        }
        
        // Atualizar preview do prêmio
        if (settings.prize_image) {
            prizePreview.src = `/static/images/${settings.prize_image}`;
        }
        
        // Atualizar estado dos botões
        drawNumberBtn.disabled = !settings.is_drawing;
    }
    
    // Renderizar tabela de cartelas
    function renderCardsTable() {
        cardsTableBody.innerHTML = '';
        
        cards.forEach(card => {
            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td>${card.card_id}</td>
                <td>${card.name}</td>
                <td>${card.numbers.join(', ')}</td>
                <td>
                    <button class="action-btn delete-btn" data-id="${card.id}">Excluir</button>
                </td>
            `;
            
            cardsTableBody.appendChild(row);
        });
        
        // Adicionar event listeners aos botões de excluir
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const cardId = this.getAttribute('data-id');
                deleteCard(cardId);
            });
        });
    }
    
    // Adicionar preview de patrocinador
    function addSponsorPreview(filename) {
        const sponsorDiv = document.createElement('div');
        sponsorDiv.className = 'sponsor-preview';
        
        sponsorDiv.innerHTML = `
            <img src="/static/images/sponsors/${filename}" alt="Patrocinador">
            <button class="remove-sponsor" data-filename="${filename}">×</button>
        `;
        
        sponsorsPreview.appendChild(sponsorDiv);
        
        // Adicionar event listener ao botão de remover
        sponsorDiv.querySelector('.remove-sponsor').addEventListener('click', function() {
            removeSponsorImage(this.getAttribute('data-filename'));
        });
    }
    
    // Manipulador de formulário de cartela
    cardForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const cardId = document.getElementById('cardId').value;
        const name = document.getElementById('cardName').value;
        const numbers = document.getElementById('cardNumbers').value
            .split(',')
            .map(num => parseInt(num.trim()))
            .filter(num => !isNaN(num));
        
        if (numbers.length !== 24) {
            alert('Por favor, insira exatamente 24 números separados por vírgula.');
            return;
        }
        
        fetch('/api/cards', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                card_id: cardId,
                name: name,
                numbers: numbers
            })
        })
        .then(response => response.json())
        .then(data => {
            Swal.fire('Sucesso!', 'Cartela adicionada com sucesso!', 'success');
            cardForm.reset();
            loadInitialData();
        })
        .catch(error => {
            Swal.fire('Erro!', 'Ocorreu um erro ao adicionar a cartela.', 'error');
            console.error('Error:', error);
        });
    });
    
    // Definir contagem regressiva
    setCountdownBtn.addEventListener('click', function() {
        const dateTime = countdownTimeInput.value;
        
        if (!dateTime) {
            Swal.fire('Aviso', 'Por favor, selecione uma data e hora.', 'warning');
            return;
        }
        
        fetch('/api/settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                countdown_time: dateTime
            })
        })
        .then(response => response.json())
        .then(data => {
            Swal.fire('Sucesso!', 'Contagem regressiva definida com sucesso!', 'success');
            settings.countdown_time = dateTime;
        })
        .catch(error => {
            Swal.fire('Erro!', 'Ocorreu um erro ao definir a contagem regressiva.', 'error');
            console.error('Error:', error);
        });
    });
    
    // Iniciar sorteio
    startDrawingBtn.addEventListener('click', function() {
        fetch('/api/start_drawing', {
            method: 'POST'
        })
        .then(response => response.json())
        .then(data => {
            Swal.fire('Sorteio Iniciado!', 'O sorteio foi iniciado com sucesso.', 'success');
            settings.is_drawing = true;
            settings.has_winner = false;
            settings.drawn_numbers = [];
            updateSettingsUI();
        })
        .catch(error => {
            Swal.fire('Erro!', 'Ocorreu um erro ao iniciar o sorteio.', 'error');
            console.error('Error:', error);
        });
    });
    
    // Sortear número
    drawNumberBtn.addEventListener('click', function() {
        fetch('/api/draw_number', {
            method: 'POST'
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                Swal.fire('Aviso', data.error, 'warning');
                return;
            }
            
            if (data.hasWinner) {
                Swal.fire({
                    title: 'Temos um vencedor!',
                    html: `Cartela ID: ${data.winner.card_id}<br>Nome: ${data.winner.name}`,
                    icon: 'success'
                });
                
                settings.has_winner = true;
                settings.is_drawing = false;
            } else {
                settings.drawn_numbers.push(data.number);
            }
            
            updateSettingsUI();
        })
        .catch(error => {
            Swal.fire('Erro!', 'Ocorreu um erro ao sortear o número.', 'error');
            console.error('Error:', error);
        });
    });
    
    // Reiniciar sorteio
    resetDrawingBtn.addEventListener('click', function() {
        fetch('/api/settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                is_drawing: false,
                has_winner: false,
                drawn_numbers: []
            })
        })
        .then(response => response.json())
        .then(data => {
            Swal.fire('Sorteio Reiniciado!', 'O sorteio foi reiniciado com sucesso.', 'success');
            settings.is_drawing = false;
            settings.has_winner = false;
            settings.drawn_numbers = [];
            updateSettingsUI();
        })
        .catch(error => {
            Swal.fire('Erro!', 'Ocorreu um erro ao reiniciar o sorteio.', 'error');
            console.error('Error:', error);
        });
    });
    
    // Upload de imagem de patrocinador
    uploadSponsorBtn.addEventListener('click', function() {
        const file = sponsorImageInput.files[0];
        
        if (!file) {
            Swal.fire('Aviso', 'Por favor, selecione um arquivo de imagem.', 'warning');
            return;
        }
        
        const formData = new FormData();
        formData.append('file', file);
        
        fetch('/api/upload', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                Swal.fire('Erro!', data.error, 'error');
                return;
            }
            
            const newSponsors = [...(settings.sponsor_images || []), data.filename];
            
            return fetch('/api/settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sponsor_images: newSponsors
                })
            });
        })
        .then(response => response.json())
        .then(data => {
            Swal.fire('Sucesso!', 'Imagem do patrocinador adicionada com sucesso!', 'success');
            settings.sponsor_images = data.sponsor_images;
            addSponsorPreview(data.sponsor_images[data.sponsor_images.length - 1]);
            sponsorImageInput.value = '';
        })
        .catch(error => {
            Swal.fire('Erro!', 'Ocorreu um erro ao fazer upload da imagem.', 'error');
            console.error('Error:', error);
        });
    });
    
    // Upload de imagem do prêmio
    uploadPrizeBtn.addEventListener('click', function() {
        const file = prizeImageInput.files[0];
        
        if (!file) {
            Swal.fire('Aviso', 'Por favor, selecione um arquivo de imagem.', 'warning');
            return;
        }
        
        const formData = new FormData();
        formData.append('file', file);
        
        fetch('/api/upload', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                Swal.fire('Erro!', data.error, 'error');
                return;
            }
            
            return fetch('/api/settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    prize_image: data.filename
                })
            });
        })
        .then(response => response.json())
        .then(data => {
            Swal.fire('Sucesso!', 'Imagem do prêmio atualizada com sucesso!', 'success');
            settings.prize_image = data.prize_image;
            prizePreview.src = `/static/images/${data.prize_image}`;
            prizeImageInput.value = '';
        })
        .catch(error => {
            Swal.fire('Erro!', 'Ocorreu um erro ao fazer upload da imagem.', 'error');
            console.error('Error:', error);
        });
    });
    
    // Remover imagem de patrocinador
    function removeSponsorImage(filename) {
        const newSponsors = settings.sponsor_images.filter(img => img !== filename);
        
        fetch('/api/settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                sponsor_images: newSponsors
            })
        })
        .then(response => response.json())
        .then(data => {
            Swal.fire('Sucesso!', 'Patrocinador removido com sucesso!', 'success');
            settings.sponsor_images = data.sponsor_images;
            loadInitialData();
        })
        .catch(error => {
            Swal.fire('Erro!', 'Ocorreu um erro ao remover o patrocinador.', 'error');
            console.error('Error:', error);
        });
    }
    
    // Excluir cartela
    function deleteCard(cardId) {
        Swal.fire({
            title: 'Tem certeza?',
            text: "Você não poderá reverter isso!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Sim, excluir!'
        }).then((result) => {
            if (result.isConfirmed) {
                fetch(`/api/cards/${cardId}`, {
                    method: 'DELETE'
                })
                .then(response => {
                    if (response.ok) {
                        Swal.fire('Excluído!', 'A cartela foi excluída.', 'success');
                        loadInitialData();
                    } else {
                        throw new Error('Erro ao excluir cartela');
                    }
                })
                .catch(error => {
                    Swal.fire('Erro!', 'Ocorreu um erro ao excluir a cartela.', 'error');
                    console.error('Error:', error);
                });
            }
        });
    }
    
    // Carregar dados iniciais
    loadInitialData();
});