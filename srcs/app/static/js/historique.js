const historiqueModal = document.getElementById('historiqueModal');
const historiqueForm = document.getElementById('historiqueForm');
const historiqueLink = document.getElementById('historiqueLink');

function escapeHtmlHistorique(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function loadMatchHistory() {
    try {
        fetch('/api/user/match-history/', {
            headers: {
                'X-CSRFToken': getCsrfToken(),
            },
            credentials: 'same-origin'
        })
        .then(response => {
            if (!response.ok) {
                historiqueForm.innerHTML = `
                    <div class="auth-message">
                        <i class="fas fa-lock"></i>
                        <p>Connectez-vous pour accéder à votre historique de parties</p>
                    </div>`;
                return null;
            }
            return response.json();
        })
        .then(data => {
            if (data) {
                displayMatchHistory(data);
            }
        })
        .catch(error => {
            console.error('Erreur:', error);
            historiqueForm.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
        });
    } catch (error) {
        console.error('Erreur:', error);
        historiqueForm.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
    }
}

function displayMatchHistory(data) {
    historiqueForm.innerHTML = '';
    
    const tableWrapper = document.createElement('div');
    tableWrapper.className = 'table-wrapper';
    
    const table = document.createElement('table');
    table.className = 'table table-striped match-history-table';
    
    const thead = document.createElement('thead');
    thead.innerHTML = `
        <tr>
            <th>Date et Heure</th>
            <th>Type</th>
            <th>Gagnants</th>
            <th>Perdants</th>
            <th>Score</th>
        </tr>
    `;
    table.appendChild(thead);
    
    const tbody = document.createElement('tbody');
    const displayedMatches = data.results.slice().reverse().slice(0, 5);
    
    displayedMatches.forEach(match => {
        const row = document.createElement('tr');
        
        const matchDate = new Date(match.date);
        const formattedDateTime = escapeHtmlHistorique(matchDate.toLocaleDateString() + ' ' + matchDate.toLocaleTimeString());
        
        const matchResults = match.results;
        const winners = matchResults.winners 
            ? escapeHtmlHistorique(matchResults.winners.join(', ')) 
            : '-';
        const losers = matchResults.losers 
            ? escapeHtmlHistorique(matchResults.losers.join(', ')) 
            : '-';
        const score = escapeHtmlHistorique(matchResults.score || '-');
        const gameType = (match.nb_players === 2) ? "1v1" : "2v2";
        row.innerHTML = `
            <td class="datetime-cell">${formattedDateTime}</td>
            <td class="type-cell">${gameType}</td>
            <td class="players-cell" title="${winners}">${winners}</td>
            <td class="players-cell" title="${losers}">${losers}</td>
            <td class="score-cell">${score}</td>
        `;
        tbody.appendChild(row);
    });
    table.appendChild(tbody);
    
    tableWrapper.appendChild(table);
    historiqueForm.appendChild(tableWrapper);
}

function openHistoriqueModal() {
    const modal = new bootstrap.Modal(historiqueModal);
    loadMatchHistory();
    modal.show();
}

// historiqueLink.addEventListener('click', (e) => {
//     e.preventDefault();
//     history.pushState(
//         { modal: 'historique' },
//         '', 
//         '/historique'
//     );
//     openHistoriqueModal();
// });

// window.addEventListener('popstate', (event) => {
//     if (event.state && event.state.modal === 'historique') {
//         openHistoriqueModal();
//     } else {
//         const modal = bootstrap.Modal.getInstance(historiqueModal);
//         if (modal) {
//             modal.hide();
//         }
//     }
// });

// historiqueModal.addEventListener('hidden.bs.modal', () => {
//     if (window.location.pathname === '/historique') {
//         history.back();
//     }
// });

// if (window.location.pathname === '/historique') {
//     history.replaceState({ modal: 'historique' }, '', '/historique');
//     openHistoriqueModal();
// }

// let previousPath = null;

function pushModalState2() {
    // Sauvegarde le chemin actuel avant de le modifier
    previousPath = window.location.pathname;
    // Ajoute le nouvel état dans l'historique
    history.pushState(
        { 
            modal: 'historique',
            previousPath: previousPath 
        },
        '',
        '/historique'
    );
}

function closeModal2() {
    const modal = bootstrap.Modal.getInstance(historiqueModal);
    if (modal) {
        modal.hide();
    }
}

// Gestionnaire pour le clic sur le lien utilisateur
historiqueLink.addEventListener('click', (e) => {
    e.preventDefault();
    pushModalState2();
    openHistoriqueModal();
});

// Gestionnaire pour la navigation dans l'historique
window.addEventListener('popstate', (event) => {
    if (event.state && event.state.modal === 'historique') {
        openHistoriqueModal();
    } else {
        closeModal2();
    }
});

// Gestionnaire pour la fermeture du modal
historiqueModal.addEventListener('hidden.bs.modal', () => {
    if (window.location.pathname === '/historique') {
        // Au lieu de history.back(), on push un nouvel état
        const targetPath = previousPath || '/';
        history.pushState(
            { 
                modal: null,
                previousPath: '/historique' 
            },
            '',
            targetPath
        );
    }
});

// Gestion de l'état initial
if (window.location.pathname === '/historique') {
    history.replaceState(
        { 
            modal: 'historique',
            previousPath: '/' 
        }, 
        '', 
        '/historique'
    );
    openHistoriqueModal();
}