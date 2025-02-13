const friendModal = document.getElementById('friendModal');
const friendLink = document.getElementById('friendLink');
const friendProfileModal = new bootstrap.Modal(document.getElementById('friendProfileModal'));
const modalBody = document.getElementById('friendModalBody');
let previousPath = null;

function escapeHtmlFriend(unsafe) {
	if (!unsafe) return "";
	return unsafe
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

function openFriendModal() {
	const modal = new bootstrap.Modal(friendModal);
	updateFriendModalBody();
	loadFriendLists();
	modal.show();
}

function pushModalState4() {
	previousPath = window.location.pathname;
	history.pushState(
		{
			modal: 'friend',
			previousPath: previousPath
		},
		'',
		'/friend'
	);
}

function closeModal4() {
	const modal = bootstrap.Modal.getInstance(friendModal);
	const profileModal = bootstrap.Modal.getInstance(document.getElementById('friendProfileModal'));

	if (modal) {
		modal.hide();
	}

	if (profileModal && profileModal._isShown) {
		profileModal.hide();
	}
}

// Gestionnaire pour le clic sur le lien utilisateur
friendLink.addEventListener('click', (e) => {
	console.log("[friendLink.addEventListener]");
	e.preventDefault();
	pushModalState4();
	openFriendModal();
});

// Gestionnaire pour la navigation dans l'historique
window.addEventListener('popstate', (event) => {
	if (event.state && event.state.modal === 'friend') {
		openFriendModal();
	} else {
		closeModal4();
	}
});

//Gestionnaire pour la fermeture du modal
friendModal.addEventListener('hidden.bs.modal', () => {
	if (window.location.pathname === '/friend') {
		// Au lieu de history.back(), on push un nouvel état
		const targetPath = previousPath || '/';
		history.pushState(
			{
				modal: null,
				previousPath: '/friend'
			},
			'',
			targetPath
		);
	}
});

// Gestion de l'état initial
if (window.location.pathname === '/friend') {
	history.replaceState(
		{
			modal: 'friend',
			previousPath: '/'
		},
		'',
		'/friend'
	);
	openFriendModal();
}

function updateFriendModalBody() {
	modalBody.innerHTML = `
		<div class="custom-tabs-container">
			<ul class="nav nav-tabs nav-fill" id="friendTabs" role="tablist">
				<li class="nav-item" role="presentation">
					<button class="nav-link custom-tab-button barre-choix" id="friend-list-tab"
					data-bs-toggle="pill" data-bs-target="#friend-list" type="button" role="tab"
					aria-controls="friend-list" aria-selected="true">Liste d'amis</button>
				</li>
				<li class="nav-item" role="presentation">
					<button class="nav-link custom-tab-button barre-choix" id="add-friend-tab" data-bs-toggle="pill"
					data-bs-target="#add-friend" type="button" role="tab" aria-controls="add-friend"
					aria-selected="false">Ajouter un ami</button>
				</li>
			</ul>
		</div>
		<div class="tab-content custom-tab-content" id="friendTabsContent">
			<div class="tab-pane fade show active" id="friend-list" role="tabpanel" aria-labelledby="friend-list-tab">
				<h6 class="friend-list-title">Vos abonnements</h6>
				<ul id="followingList" class="list-group custom-list-group">
				</ul>
				<h6 class="friend-list-title">Vos abonnés</h6>
				<ul id="followersList" class="list-group custom-list-group">
				</ul>
			</div>
			<div class="tab-pane fade" id="add-friend" role="tabpanel" aria-labelledby="add-friend-tab">
				<form id="addFriendForm" class="mt-3">
					<div class="mb-3">
						<p for="friendUsername" class="form-label">Nom d'utilisateur de l'ami</p>
						<input type="text" class="form-control custom-input" id="friendUsername" required>
					</div>
					<button type="submit" class="btn custom-btn">Ajouter</button>
				</form>
			</div>
		</div>
	`;

	const addFriendForm = document.getElementById('addFriendForm');
	if (addFriendForm) {
		addFriendForm.addEventListener('submit', handleAddFriend);
	}
}

function handleAddFriend(e) {
	e.preventDefault();
	const friendUsername = document.getElementById('friendUsername').value.trim();

	if (!friendUsername) {
		alert(t('errorFriend'));
		return;
	}

	const validFriendUsername = validateInput(friendUsername, 'username');

	try {
		if (!validFriendUsername || validFriendUsername == "1") {
			alert(t('invalidFriendName'));
			throw new Error('invalid friend name!');
		}
	}
	catch(error) {
		// /console.log(error);
		return ;
	}

	fetch(`/api/users/${friendUsername}/`, {
		headers: {
			'X-CSRFToken': getCookie('csrftoken'),
		},
		credentials: 'same-origin'
	})
	.then(response => {
		if (!response.ok) throw new Error('L\'utilisateur n\'existe pas');
		return response.json();
	})
	.then(data => {
		if (!data.id) throw new Error('ID de l\'utilisateur n\'existe pas');

		return fetch(`/api/addfriend/${data.id}/`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-CSRFToken': getCookie('csrftoken'),
			},
			credentials: 'same-origin'
		});
	})
	.then(response => {
		if (!response.ok) {
			return response.json().then(data => {
				console.error('Error response:', data);
				throw new Error(data.detail || 'Erreur lors de l\'ajout');
			});
		}
		return response.json();
	})
	.then(data => {
		alert(data.detail);
		document.getElementById('friendUsername').value = '';
		loadFriendLists();
	})
	.catch(error => {
		console.error('Erreur complète:', error);
		alert(t('userNotFound'));
	});
}

window.addEventListener('userLoggedIn', () => {
    loadFriendLists();
});

function getProfilePictureUrl(username) {
	return `/static/images/${escapeHtmlFriend(username)}.jpg`;
}

function loadFriendLists() {
	const followingList = document.getElementById('followingList');
	const followersList = document.getElementById('followersList');
	console.log("call api /api/following/");
	fetch('/api/following/', {
		headers: {
			'X-CSRFToken': getCookie('csrftoken'),
		},
		credentials: 'same-origin'
	})
	.then(response => {
		if (!response.ok) throw new Error('Erreur lors du chargement des amis');
		return response.json();
	})
	// /!\ trouver une soluton pour la photo de profile
	.then(data => {
		console.log("il y a une reponse positive au call api : ");
		if (followingList) {
			if (data.length === 0) {
				followingList.innerHTML = `<li class="custom-list-group-item text-muted">${t('noFollowing')}</li>`;
				return;
			}
			followingList.innerHTML = data.map(user => `
				<li class="custom-list-group-item p-3">
					<div class="d-flex justify-content-between align-items-center">
						<div class="d-flex align-items-center">
							<div class="profile-picture-small me-3"
								style="width: 40px; height: 40px;
										border-radius: 50%;
										background-size: cover;
										background-position: center;
										background-image: url('${getProfilePictureUrl(user.username)}');">
							</div>
							<div>
								<div class="fw-bold">${escapeHtmlUser(user.username)}</div>
								<small class="text-muted">${escapeHtmlUser(user.alias)}</small>
							</div>
						</div>
						<div class="d-flex gap-2">
							<button class="btn btn-sm custom-btn view-profile"
									style="background-color: #194452; color: #ad996d;"
									data-user-id="${user.id}">
								Voir profil
							</button>
							<button class="btn btn-sm custom-btn delete-friend"
									style="background-color: #194452; color: #ad996d;"
									data-user-id="${user.id}">
								Ne plus suivre
							</button>
						</div>
					</div>
				</li>
			`).join('');
		}
		console.log("2");
		attachEventListeners();
	})
	.catch(error => {
		console.log("erreur : ", error);
		modalBody.innerHTML = `
			<div class="auth-message">
				<i class="fas fa-lock"></i>
				<p>Aucune information utilisateur disponible</p>
			</div>`;
		return;
	});
	console.log("call api /api/followers/");
	fetch('/api/followers/', {
		headers: {
			'X-CSRFToken': getCookie('csrftoken'),
		},
		credentials: 'same-origin'
	})
	.then(response => {
		if (!response.ok) throw new Error('Erreur lors du chargement des followers');
		return response.json();
	})
	.then(data => {
		if (followersList) {
			if (data.length === 0) {
				followersList.innerHTML = `<li class="custom-list-group-item text-muted">${t('noFollowers')}</li>`;
				return;
			}
			followersList.innerHTML = data.map(user => `
				<li class="custom-list-group-item p-3">
					<div class="d-flex justify-content-between align-items-center">
						<div class="d-flex align-items-center">
							<div class="profile-picture-small me-3"
								style="width: 40px; height: 40px;
										border-radius: 50%;
										background-size: cover;
										background-position: center;
										background-image: url('${getProfilePictureUrl(user.username)}');">
							</div>
							<div>
								<div class="fw-bold">${escapeHtmlUser(user.username)}</div>
								<small class="text-muted">${escapeHtmlUser(user.alias)}</small>
							</div>
						</div>
						<button class="btn btn-sm custom-btn view-profile"
								data-user-id="${user.id}">
							Voir profil
						</button>
					</div>
				</li>
			`).join('');
			attachEventListeners();
		}
	})
	.catch(error => {
		modalBody.innerHTML = `
		<div class="auth-message">
			<i class="fas fa-lock"></i>
			<p>Aucune information utilisateur disponible</p>
		</div>`;
	});
}

function attachEventListeners() {
	const deleteButtons = document.querySelectorAll('.delete-friend');
	deleteButtons.forEach(button => {
		button.addEventListener('click', handleDeleteFriend);
	});

	const profileButtons = document.querySelectorAll('.view-profile');
	profileButtons.forEach(button => {
		button.addEventListener('click', handleViewProfile);
	});
}

function handleDeleteFriend(e) {
	e.preventDefault();
	const userId = e.target.getAttribute('data-user-id');

	if (!userId) return;

	if (confirm('Êtes-vous sûr de ne plus vouloir suivre cet utilisateur ?')) {
		fetch(`/api/suppfriend/${userId}/`, {
			method: 'DELETE',
			headers: {
				'X-CSRFToken': getCookie('csrftoken'),
				'Content-Type': 'application/json'
			},
			credentials: 'same-origin'
		})
		.then(response => {
			if (!response.ok) throw new Error('Erreur lors de la suppression');
			return response.json();
		})
		.then(data => {
			alert(data.detail);
			loadFriendLists();
		})
		.catch(error => {
			console.error('Erreur:', error);
			alert("Une erreur est survenue lors de la suppression");
		});
	}
}

function handleViewProfile(e) {
	e.preventDefault();
	const userId = e.target.getAttribute('data-user-id');
	if (userId) {
		fetch(`/api/userprofile/${userId}/`)
			.then(response => {
				if (!response.ok) throw new Error('L\'utilisateur n\'existe pas');
					return response.json();
			})
			.then(data => {
				// /!\ a modifier avec onlinestatus
				// const onlineStatus = data.is_online
				//     ? `<span class="text-success">En ligne</span>`
				//     : `<span class="text-muted">Déconnecté</span>`;

				console.log("[handleViewProfile] data : ", data);

				// /!\ remplacer la div par une img de la photo de profile de l'utilisateur
				document.getElementById('friendProfileContent').innerHTML = `
					<div class="text-center mb-3">
						<div class="profile-picture-large mx-auto mb-2"
							style="width: 100px; height: 100px;
									border-radius: 50%;
									background-size: cover;
									background-position: center;
									background-image: url('${getProfilePictureUrl(data.username)}');">
						</div>
						<h4>${escapeHtmlUser(data.username)}</h4>
						<p class="text-muted">${escapeHtmlUser(data.alias)}</p>
						<div class="mb-2" id="${data.onlineStatus ? 'liveChat-onlineStatus' : 'liveChat-offlineStatus'}">
							${data.onlineStatus ? "En ligne" : "Hors ligne"}
						</div>
					</div>
					<div class="row text-center">
						<div class="col-4">
							<h5>${data.nbVictoires + data.nbDefaites}</h5>
							<small class="text-muted">Parties</small>
						</div>
						<div class="col-4">
							<h5>${data.nbVictoires}</h5>
							<small class="text-muted">Victoires</small>
						</div>
						<div class="col-4">
							<h5>${data.nbDefaites}</h5>
							<small class="text-muted">Défaites</small>
						</div>
					</div>
				`;
				friendProfileModal.show();
			})
			.catch(error => console.log(error));
	}
}

function getCookie(name) {
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

// friendModal.addEventListener('show.bs.modal', () => {
//     updateFriendModalBody();
//     loadFriendLists();
// });

// updateFriendModalBody();
// loadFriendLists();
