// tournament.js
const tournamentModal = document.getElementById('tournamentModal');
const tournamentForm = document.getElementById('tournamentForm');
const playerCountSelect = document.getElementById('playerCount');
const aliasInputs = document.getElementById('aliasInputs');
const tournamentLink = document.getElementById('tournamentLink');
const nextGameForm = document.getElementById('nextGameForm');
let activeModalPromise = null;
let activeCheckInterval = null;
let activeModalResolver = null;

function escapeHtmlTournois(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function showFullScreenTournamentModal() {

    const existingModal = document.getElementById('tournamentFullScreenModal');
    if (existingModal) {
        existingModal.remove();
    }

    const modal = document.createElement('div');
    modal.id = 'tournamentFullScreenModal';
    modal.className = 'modal show';
    modal.setAttribute('tabindex', '-1');
    modal.setAttribute('role', 'dialog');
    modal.style.cssText = `
        display: block;
        background-color: rgba(13, 30, 41, 0.9);
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 2;
        overflow: hidden;
    `;

    modal.innerHTML = `
        <div class="modal-dialog modal-fullscreen" role="document" style="max-width: 100%; margin: 0; height: 100%; display: flex; align-items: flex-end; justify-content: center;">
            <div class="modal-content" style="
                height: auto;
                width: 100%;
                background: transparent;
                box-shadow: none;
                display: flex;
                flex-direction: column;
                align-items: center;
                padding-bottom: 20vh;
            ">
                <div class="modal-body text-center" style="color: #ad996d; text-align: center; width: 100%;">
                    <div class="spinner-border" role="status" style="
                        width: 3rem;
                        height: 3rem;
                        color: #ad996d;
                        border-width: 0.25em;
                        margin-bottom: 20px;
                    ">
                        <span class="visually-hidden">Chargement...</span>
                    </div>
                    <h2 class="mt-3" style="
                        color: #ad996d;
                        font-size: 2rem;
                        margin-bottom: 15px;
                    ">Tournoi en cours</h2>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    modal.style.zIndex = '2';

    return function closeFullScreenModal() {
        const modalToRemove = document.getElementById('tournamentFullScreenModal');
        if (modalToRemove) {
            modalToRemove.remove();
        }
    };
}

playerCountSelect.addEventListener('change', updateAliasInputs);

function updateAliasInputs() {
    const playerCount = parseInt(playerCountSelect.value);
    aliasInputs.innerHTML = '';

    for (let i = 1; i <= playerCount; i++) {
        const input = document.createElement('div');
        input.classList.add('mb-3');
        input.innerHTML = `
        <p for="alias${i}" class="form-label">Alias du joueur ${escapeHtmlTournois(i.toString())}</p>
        <input type="text" class="form-control" id="alias${escapeHtmlTournois(i.toString())}" required>
        `;
        aliasInputs.appendChild(input);
    }
}

tournamentForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const playerCount = parseInt(playerCountSelect.value);
    const aliasNames = [];

    for (let i = 1; i <= playerCount; i++) {
        const aliasInput = document.getElementById(`alias${i}`);
        if (aliasInput && aliasInput.value.trim() !== '') {
            aliasNames.push(aliasInput.value.trim());
        }
    }

    for (let index = 0; index < playerCount; index++) {

        const validAlias = validateInput(aliasNames[index], 'alias');

        try {
            if (!validAlias || validAlias == "1") {
                alert(t('invalidAliasFormat'));
                throw new Error('invalidAliasFormat')
            }
        } catch (error) {
            return ;
        }
    }

    if (aliasNames.length !== playerCount) {
        alert(t('pleaseEnterValidAliases').replace('{count}', playerCount));
        return;
    }

    try {
        const response = await fetchWithCsrf('/api/tournaments/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken(),
            },
            body: JSON.stringify({
                nb_players: playerCount,
                alias_names: aliasNames,
            }),
        });

        if (response.status === 201) {
            const tournamentData = await response.json();
            bootstrap.Modal.getInstance(tournamentModal).hide();
            startTournament(tournamentData.id);
        } else {
            const errorData = await response.json();
            alert(t('tournamentCreationError'));
        }
    } catch (error) {
        console.error('Erreur lors de la création du tournoi:', error);
        alert(t('tournamentCreationError'));
    }
});

async function startTournament(tournamentId) {
    const closeFullScreenModal = showFullScreenTournamentModal();
    let tournamentFinished = false;
    let navigationInterrupted = false;
    let isNavigatingBack = false;

    const navigationHandler = () => {
        navigationInterrupted = true;
        isNavigatingBack = true;
        if (activeCheckInterval) {
            clearInterval(activeCheckInterval);
            activeCheckInterval = null;
        }
        if (activeModalResolver) {
            activeModalResolver();
        }
        closeFullScreenModal();
    };
    window.addEventListener('popstate', navigationHandler);

    while (!tournamentFinished && !navigationInterrupted) {
        try {
            if (isNavigatingBack) {
                break;
            }
            const response = await fetch(`/api/tournaments/${tournamentId}/next-play/`);
            const data = await response.json();
            const test = await fetch(`/api/play/detail/${data.play_id}`);
            const data2 = await test.json();

            if (response.status === 200 && !navigationInterrupted) {

                try {
                    await showNextGameModal(data2);

                    if (navigationInterrupted || isNavigatingBack) {  // Vérification ajoutée
                        logger.warn('Navigation interrupted during game modal');
                        break;
                    }

                    const newUrl = `/game/${data.play_id}`;
                    const newTitle = `Pong Game ${data.play_id}`;
                    const newContent = `Playing Pong Game ${data.play_id}`;

                    if (!navigationInterrupted && !isNavigatingBack) {  // Vérification ajoutée
                        PongGame.navigateTo(newTitle, newUrl, newContent, data.play_id);
                        PongGame.initializeGame(data.play_id, 2, true);

                        if (!navigationInterrupted && !isNavigatingBack) {  // Vérification finale
                            await waitForGameCompletion(data.play_id);
                        }
                    }
                } catch (error) {
                    if (navigationInterrupted || isNavigatingBack) {
                        break;
                    }
                    throw error;
                    // continue;
                }
            } else if (response.status === 410) {
                tournamentFinished = true;
                await displayTournamentResults(tournamentId);
                closeFullScreenModal();
            } else {
                throw new Error('Erreur inattendue');
            }
        } catch (error) {
            // console.error('Erreur lors du déroulement du tournoi:', error);
            // alert('Une erreur est survenue lors du déroulement du tournoi.');
            tournamentFinished = true;
            closeFullScreenModal();
        }
    }
    window.removeEventListener('popstate', navigationHandler);
    if (activeCheckInterval) {
        clearInterval(activeCheckInterval);
        activeCheckInterval = null;
    }
}

function showNextGameModal(data) {
    if (activeModalResolver) {
        activeModalResolver();
        activeModalResolver = null;
    }

    return new Promise((resolve, reject) => {
        const nextGameModal = document.getElementById('nextGameModal');
        const startNextGameButton = document.getElementById('startNextGameButton');
        const nextGameInfoForm = document.createElement('form');

        nextGameInfoForm.innerHTML = `
            <p>Prochaine partie : ${escapeHtmlTournois(data.player_name[0])} VS ${escapeHtmlTournois(data.player_name[1])}</p>
        `;
        nextGameForm.innerHTML = '';
        nextGameForm.appendChild(nextGameInfoForm);

        const modal = new bootstrap.Modal(nextGameModal, {
            backdrop: 'static',
            keyboard: false
        });

        const handleNextGame = () => {
            startNextGameButton.removeEventListener('click', handleNextGame);
            nextGameModal.removeEventListener('hidden.bs.modal', handleModalHidden);
            modal.hide();
            resolve();
        };

        const handleModalHidden = (event) => {
            startNextGameButton.removeEventListener('click', handleNextGame);
            nextGameModal.removeEventListener('hidden.bs.modal', handleModalHidden);
            activeModalPromise = null;
            activeModalResolver = null;
            if (!event.clickedButton) {
                reject(new Error('La fenêtre modale a été fermée sans démarrer la partie'));
            }
        };

        const cleanup = () => {
            if (modal) {
                modal.hide();
            }
            startNextGameButton.removeEventListener('click', handleNextGame);
            nextGameModal.removeEventListener('hidden.bs.modal', handleModalHidden);
            activeModalPromise = null;
            activeModalResolver = null;
        };

        activeModalResolver = () => {
            cleanup();
            reject(new Error('Navigation de la fenêtre modale interrompue'));
        };

        startNextGameButton.addEventListener('click', handleNextGame);
        nextGameModal.addEventListener('hidden.bs.modal', handleModalHidden);
        modal.show();
    });
}

function waitForGameCompletion(playId) {

    if (activeCheckInterval) {
        clearInterval(activeCheckInterval);
        activeCheckInterval = null;
    }

    return new Promise((resolve) => {
        activeCheckInterval = setInterval(() => {
            PongGame.fetchGameDetails(playId)
                .then(gameDetails => {
                    if (gameDetails.is_finished) {
                        clearInterval(activeCheckInterval);
                        activeCheckInterval = null;
                        resolve();
                    }
                })
                .catch(error => {
                    console.error('Erreur lors de la vérification de l\'état du jeu:', error);
                    clearInterval(activeCheckInterval);
                    activeCheckInterval = null;
                    resolve();
                });
        }, 5000);
    });
}

PongGame.fetchGameDetails = async function(gameId) {
    return fetch(`/api/play/detail/${gameId}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .catch(error => {
            console.log(error);
        });
};

async function displayTournamentResults(tournamentId) {
    try {
        const response = await fetch(`/api/tournaments/${tournamentId}/`);
        const data = await response.json();

        if (response.status === 200) {
            console.log('Résultats du tournoi:', data);
        } else {
            throw new Error('Erreur inattendue');
        }
    } catch (error) {
        console.error('Erreur lors de l\'affichage des résultats du tournoi:', error);
        alert('Une erreur est survenue lors de l\'affichage des résultats du tournoi.');
    }
}

updateAliasInputs();

function openTournamentModal() {
    const modal = new bootstrap.Modal(tournamentModal);
    modal.show();
}

function pushModalState3() {
    previousPath = window.location.pathname;
    history.pushState(
        {
            modal: 'tournaments',
            previousPath: previousPath
        },
        '',
        '/tournaments'
    );
}

function closeModal3() {
    const modal = bootstrap.Modal.getInstance(tournamentModal);
    if (modal) {
        modal.hide();
    }
}

tournamentLink.addEventListener('click', (e) => {
    e.preventDefault();
    pushModalState3();
    openTournamentModal();
});

window.addEventListener('popstate', (event) => {
    if (event.state && event.state.modal === 'tournaments') {
        openTournamentModal();
    } else {
        closeModal3();
    }

    const fullScreenModal = document.getElementById('tournamentFullScreenModal');
    if (fullScreenModal && (!event.state || event.state.modal !== 'tournamentFullScreen')) {
        isTournamentGame = false;
        fullScreenModal.remove();
    }

    const nextGameModal = bootstrap.Modal.getInstance(document.getElementById('nextGameModal'));
    if (nextGameModal && (!event.state || event.state.modal !== 'nextGame')) {
        nextGameModal.hide();
    }
});

tournamentModal.addEventListener('hidden.bs.modal', () => {
    if (window.location.pathname === '/tournaments') {
        const targetPath = previousPath || '/';
        history.pushState(
            {
                modal: null,
                previousPath: '/tournaments'
            },
            '',
            targetPath
        );
    }
});

if (window.location.pathname === '/tournaments') {
    history.replaceState(
        {
            modal: 'tournaments',
            previousPath: '/'
        },
        '',
        '/tournaments'
    );
    openTournamentModal();
}
