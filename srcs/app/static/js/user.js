const userModal = document.getElementById('userModal');
const userLink = document.getElementById('userLink');
const userForm = document.getElementById('userForm');

function escapeHtmlUser(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function updateCsrfToken2() {
    return fetch('/api/get-csrf-token/', {
        method: 'GET',
        credentials: 'include'
    })
    .then(response => response.json())
    .then(data => {
        document.querySelector('[name=csrfmiddlewaretoken]').value = data.csrfToken;
    });
}

function fetchWithCsrf2(url, options = {}) {
    return updateCsrfToken2()
        .then(() => {
            options.headers = options.headers || {};
            options.headers['X-CSRFToken'] = getCsrfToken();
            options.credentials = 'include';
            return fetch(url, options);
        });
}

function checkLoginStatus2() {
    return fetchWithCsrf2('/api/user/', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        }
    })
    .then(response => response.json())
    .catch(error => {
        console.error('Error:', error);
        clearUserInfo();
        alert('An error occurred while fetching user information.');
    });
}

function getCookie2(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

function updateUserInfo2(user) {
    fetch(`/api/users/${user.username}/`, {
        headers: {
            'X-CSRFToken': getCookie2('csrftoken'),
        },
        credentials: 'same-origin'
    })
    .then(response => {
        if (!response.ok) throw new Error("Utilisateur non trouvé");
        return response.json();
    })
    .then(data => {
        if (!data.id) throw new Error("ID de l'utilisateur non trouvé");
        const userId = data.id;

        fetch(`/api/userprofile/${userId}/`)
            .then(response => response.json())
            .then(data => {
                const userInfoForm = document.createElement('form');
                userInfoForm.innerHTML = `
                <div class="UserInfoForm">
                    <div class="row text-center">
                        <div class="col-4">
                            <h5>${escapeHtmlUser(String(data.nbVictoires + data.nbDefaites))}</h5>
                            <small class="text-muted">Parties</small>
                        </div>
                        <div class="col-4">
                            <h5>${escapeHtmlUser(String(data.nbVictoires))}</h5>
                            <small class="text-muted">Victoires</small>
                        </div>
                        <div class="col-4">
                            <h5>${escapeHtmlUser(String(data.nbDefaites))}</h5>
                            <small class="text-muted">Défaites</small>
                        </div>
                    </div>
                    <div class="mb-3">
                        <p class="form-label">Nom d'utilisateur</p>
                        <input type="text" class="form-control" value="${escapeHtml(user.username)}" disabled>
                    </div>
                    <div class="mb-3">
                        <p class="form-label">Alias</p>
                        <input type="text" class="form-control" value="${escapeHtml(user.alias)}" disabled>
                    </div>
                    <div class="mb-3">
                        <p class="form-label">Email</p>
                        <input type="email" class="form-control" value="${escapeHtml(user.email)}" disabled>
                    </div>
                </div>`;
                userForm.innerHTML = '';
                userForm.appendChild(userInfoForm);
            })
            .catch(error => {
                console.log(error.message);
            });
    })
    .catch(error => {
        console.log(error.message);
    });
}

function clearUserInfo() {
    userForm.innerHTML = `
        <div class="auth-message">
            <i class="fas fa-lock"></i>
            <p>Aucune information utilisateur disponible</p>
        </div>
    `;
}

function openuserModal() {
    const modal = new bootstrap.Modal(userModal);
    checkLoginStatus2()
        .then(user => {
            if (user && user.username) {
                updateUserInfo2(user);
            } else {
                clearUserInfo();
            }
        })
        .catch(error => {
            console.error('Error:', error);
            clearUserInfo();
            alert(t('errorFetchingUser'));
        });
    modal.show();
}

window.addEventListener('userLoggedOut', function() {
    clearUserInfo();
    // loadFriendLists();//Ajoute par Clement
    const modal = bootstrap.Modal.getInstance(userModal);
    if (modal) {
        modal.hide();
    }
});


// userLink.addEventListener('click', (e) => {
//     e.preventDefault();
//     history.pushState(
//         { modal: 'user' },
//         '',
//         '/user'
//     );
//     openuserModal();
// });

// window.addEventListener('popstate', (event) => {
//     if (event.state && event.state.modal === 'user') {
//         openuserModal();
//     } else {
//         const modal = bootstrap.Modal.getInstance(userModal);
//         if (modal) {
//             modal.hide();
//         }
//     }
// });

// userModal.addEventListener('hidden.bs.modal', () => {
//     if (window.location.pathname === '/user') {
//         history.back();
//     }
// });

// if (window.location.pathname === '/user') {
//     history.replaceState({ modal: 'user' }, '', '/user');
//     openuserModal();
// }


// let previousPath = null;

function pushModalState() {
    console.log("[pushModalState] : '/user'");
    // Sauvegarde le chemin actuel avant de le modifier
    previousPath = window.location.pathname;
    // Ajoute le nouvel état dans l'historique
    history.pushState(
        {
            modal: 'user',
            previousPath: previousPath
        },
        '',
        '/user'
    );
}

function closeModal() {
    console.log("[closeModal]");
    const modal = bootstrap.Modal.getInstance(userModal);
    if (modal) {
        modal.hide();
    }
}

// Gestionnaire pour le clic sur le lien utilisateur
userLink.addEventListener('click', (e) => {
    e.preventDefault();
    pushModalState();
    openuserModal();
});

// Gestionnaire pour la navigation dans l'historique
window.addEventListener('popstate', (event) => {
    if (event.state && event.state.modal === 'user') {
        openuserModal();
    } else {
        closeModal();
    }
});

// Gestionnaire pour la fermeture du modal
userModal.addEventListener('hidden.bs.modal', () => {
    console.log("[userModal.addEventListener('hidden.bs.modal'] : '/user'");
    if (window.location.pathname === '/user') {
        // Au lieu de history.back(), on push un nouvel état
        const targetPath = previousPath || '/';
        history.pushState(
            {
                modal: null,
                previousPath: '/user'
            },
            '',
            targetPath
        );
    }
});

// Gestion de l'état initial
if (window.location.pathname === '/user') {
    history.replaceState(
        {
            modal: 'user',
            previousPath: '/'
        },
        '',
        '/user'
    );
    openuserModal();
}
