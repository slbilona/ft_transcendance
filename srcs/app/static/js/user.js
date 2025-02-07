// const userModal = document.getElementById('userModal');
const userLink = document.getElementById('userLink');
const userForm = document.getElementById('userForm');

function escapeHtmlUser(unsafe) {
	if (!unsafe) return "";
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

const profileModalBody = document.getElementById("userModalBody");

function rempliProfileView (data, user) {
	document.getElementById('profile-view').innerHTML = `
		<form>
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
			</div>
		</form>
	`;
}

function rempliProfileEdit () {
	document.getElementById('profile-edit').innerHTML = `
		<form id="settingsForm">
			<div class="mb-3">
				<p class="form-label">Username</p>
				<input type="text" class="form-control" id="settingsUsername" name="username">
			</div>
			<div class="mb-3">
				<p class="form-label">Email</p>
				<input type="email" class="form-control" id="settingsEmail" name="email">
			</div>
			<div class="mb-3">
				<p class="form-label">Alias</p>
				<input type="text" class="form-control" id="settingsAlias" name="alias">
			</div>
			<div class="mb-3">
				<p class="form-label">Profile Photo</p>
				<input type="file"
					class="form-control"
					id="settingsPhoto"
					name="photoProfile"
					accept="image/*"
					title="Choisir un fichier">
				<img id="photoPreview" class="mt-2" style="max-width: 200px; display: none;">
			</div>
			<div class="mb-3">
				<p class="form-label">New Password</p>
				<input type="password" class="form-control" id="settingsNewPassword" name="password">
			</div>
			<div class="mb-3">
				<p class="form-label">Confirm New Password</p>
				<input type="password" class="form-control" id="settingsConfirmPassword">
			</div>

			<button type="submit" class="btn">Save Changes</button>
		</form>
		<!-- Ajoute par clement  -->
		<div id="errorMessage" style="display: none;">
			<div class="auth-message">
				<i class="fas fa-lock"></i>
				<p>Aucune information utilisateur disponible</p>
			</div>;
		</div>
	`;
	const settingsForm = document.getElementById('settingsForm');
	if (settingsForm) {
		settingsForm.addEventListener('submit', async (e) => {
			e.preventDefault();
			const formData = new FormData(settingsForm);
			await updateUserProfile(formData);
		});
	} else {
		console.error("Erreur : settingsForm non trouvé !");
	}
}

function refreshVueProfile (user) {
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
				rempliProfileView(data, user);
			})
			.catch(error => {
				console.log(error.message);
				console.error("erreur : ", error);
			});
	})
	.catch(error => {
		console.log(error.message);
	});
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
				rempliProfileView(data, user);
				rempliProfileEdit(data);
			})
			.catch(error => {
				console.log(error.message);
				console.error("erreur : ", error);
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

// window.addEventListener('userLoggedOut', function() {
//     clearUserInfo();
//     // loadFriendLists();//Ajoute par Clement
//     const modal = bootstrap.Modal.getInstance(userModal);
//     if (modal) {
//         modal.hide();
//     }
// });


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


// // // let previousPath = null;

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

// Gestionnaire pour le clic sur le lien utilisateur
userLink.addEventListener('click', (e) => {
	e.preventDefault();
	pushModalState();
	openuserModal();
});

function closeModal() {
	console.log("[closeModal]");
	const modal = bootstrap.Modal.getInstance(userModal);
	if (modal) {
		modal.hide();
	}
}

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
